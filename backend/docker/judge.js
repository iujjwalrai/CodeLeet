const fs = require("fs");
const path = require("path");
const { exec } = require("child_process");
const { v4: uuidv4 } = require("uuid");

/*
 * Runs one judging job in a single sandbox container: cl-meter (see
 * cl-meter.c) compiles the code, runs every test case and reports how each
 * run went. Outputs are compared here, so expected outputs never enter the
 * container.
 */

const LIMITS = {
  timeMs: 3000,           // wall time per test case
  memKb: 256 * 1024,      // resident memory per test case
  compileMs: 15000,
};

// Exit codes docker itself uses when it could not start the container
const DOCKER_FAILURE_CODES = new Set([125, 126, 127]);

const SIGNAL_NAMES = { 6: "SIGABRT", 8: "SIGFPE", 9: "SIGKILL", 11: "SIGSEGV", 25: "SIGXFSZ" };

function sandboxCommand(image, workDir) {
  return `
docker run --rm \
  --cpus="1.0" \
  --memory="320m" \
  --memory-swap="320m" \
  --network none \
  --pids-limit 64 \
  --ulimit nproc=64:64 \
  --ulimit nofile=64:64 \
  --ulimit fsize=10485760 \
  --cap-drop ALL \
  --security-opt no-new-privileges \
  --read-only \
  --tmpfs /tmp:rw,exec,nosuid,size=64m \
  --user nobody \
  -v "${workDir}:/app:ro" \
  ${image} \
  cl-meter /app/job.conf
`;
}

function writeJob(workDir, { files, compile, run, testCases }) {
  // The sandbox runs as nobody, so everything must be world-readable.
  fs.chmodSync(workDir, 0o755);
  for (const [name, content] of Object.entries(files)) {
    fs.writeFileSync(path.join(workDir, name), content, { mode: 0o644 });
  }
  const testsDir = path.join(workDir, "tests");
  fs.mkdirSync(testsDir, { mode: 0o755 });
  testCases.forEach((tc, i) => {
    fs.writeFileSync(path.join(testsDir, `${i}.in`), tc.input ?? "", { mode: 0o644 });
  });
  const conf = [
    `compile=${compile}`,
    `run=${run}`,
    "tests_dir=/app/tests",
    "workdir=/tmp/w",
    `count=${testCases.length}`,
    `time_ms=${LIMITS.timeMs}`,
    `mem_kb=${LIMITS.memKb}`,
    `compile_ms=${LIMITS.compileMs}`,
    "stop_on_limit=1",
  ].join("\n");
  fs.writeFileSync(path.join(workDir, "job.conf"), conf + "\n", { mode: 0o644 });
}

/* How a single test run ended, ignoring its output */
function classify(t) {
  if (t.tle) return "time_limit_exceeded";
  if (t.mle || /OutOfMemoryError/.test(t.stderr)) return "memory_limit_exceeded";
  // Killed without cl-meter doing it: the container's memory cap (OOM killer)
  if (t.signal === 9) return t.peakKb >= LIMITS.memKb * 0.9 ? "memory_limit_exceeded" : "runtime_error";
  if (t.signal || t.exit !== 0) return "runtime_error";
  return "ok";
}

function runtimeMessage(t) {
  if (t.signal === 25) return "Output limit exceeded (10 MB)";
  const stderr = (t.stderr || "").trim();
  if (stderr) return stderr;
  if (t.signal) return `Program was killed by ${SIGNAL_NAMES[t.signal] || `signal ${t.signal}`}`;
  return `Program exited with code ${t.exit}`;
}

/* The heaviest test's measurements, for the resource timeline */
function resourcesFrom(tests) {
  if (tests.length === 0) return null;
  const t = tests.reduce((a, b) => (b.cpuMs > a.cpuMs ? b : a));
  return {
    testIndex: tests.indexOf(t),
    peakKb: t.peakKb,
    cpuMs: Math.round(t.cpuMs),
    wallMs: Math.round(t.wallMs),
    timeline: t.timeline.map(([ms, rssKb, cpuMs]) => ({ t: ms, rssKb, cpuMs })),
  };
}

/* Turns a cl-meter report into the result shape the workers publish */
function verdictFrom(report, testCases) {
  const compile = report.compile || {};
  if (compile.ran && !compile.ok) {
    return {
      status: "compilation_error",
      output: null,
      error: compile.tle ? "Compilation timed out" : (compile.log || "").trim() || "Compilation failed",
      time: Math.round(compile.wallMs || 0),
      memory: 0,
      resources: null,
    };
  }

  const tests = report.tests || [];
  let passedCount = 0;
  let failure = null;

  testCases.forEach((tc, i) => {
    const t = tests[i];
    // A test that never ran (cl-meter stopped after a limit) counts as failed
    if (!t) return;
    const kind = classify(t);
    if (kind === "ok" && t.stdout.trim() === tc.output.trim()) {
      passedCount++;
    } else if (!failure) {
      failure = { index: i, kind: kind === "ok" ? "wrong_answer" : kind, t, tc };
    }
  });

  const base = {
    passedCount,
    totalCount: testCases.length,
    time: Math.round(Math.max(0, ...tests.map((t) => t.wallMs))),
    memory: Math.max(0, ...tests.map((t) => t.peakKb)),
    resources: resourcesFrom(tests),
  };

  if (!failure) {
    return { status: "accepted", output: "All test cases passed", error: null, ...base };
  }

  const { index, kind, t, tc } = failure;
  const where = `on test case ${index + 1}`;
  switch (kind) {
    case "wrong_answer": {
      const output = t.stdout.trim();
      return {
        status: "wrong_answer",
        output,
        failedTestCase: tc,
        failedTestCaseIndex: index,
        error: `Expected: ${tc.output}, Got: ${output}`,
        ...base,
      };
    }
    case "time_limit_exceeded":
      return { status: kind, output: null, failedTestCaseIndex: index, error: `Time limit exceeded ${where} (limit ${LIMITS.timeMs} ms)`, ...base };
    case "memory_limit_exceeded":
      return { status: kind, output: null, failedTestCaseIndex: index, error: `Memory limit exceeded ${where} (limit ${LIMITS.memKb / 1024} MB)`, ...base };
    default:
      return { status: "runtime_error", output: null, failedTestCaseIndex: index, error: runtimeMessage(t), ...base };
  }
}

function dockerRun(cmd, timeout) {
  return new Promise((resolve, reject) => {
    exec(cmd, { timeout, maxBuffer: 256 * 1024 * 1024 }, (err, stdout, stderr) => {
      if (err && (err.killed || DOCKER_FAILURE_CODES.has(err.code))) {
        // Docker could not run the job at all: not the user's fault
        return reject(new Error(err.killed ? "Judge timed out" : `Sandbox failed to start: ${(stderr || err.message).trim()}`));
      }
      resolve({ stdout, exitCode: err ? err.code : 0 });
    });
  });
}

/**
 * judge({ image, prefix, files, compile, run, testCases })
 *   files    { filename: content } written to /app in the container
 *   compile  shell command run once in the work dir (copies from /app)
 *   run      single command run per test case, input on stdin
 */
async function judge({ image, prefix, files, compile, run, testCases }) {
  if (!Array.isArray(testCases) || testCases.length === 0) {
    throw new Error("No test cases provided");
  }

  // Host path shared with the sandbox containers. When the worker itself runs in
  // Docker, mount the same host path at the same path inside it.
  const baseDir = process.env.CODE_TMP_DIR || path.join(process.cwd(), "tmp");
  fs.mkdirSync(baseDir, { recursive: true });
  const workDir = fs.mkdtempSync(path.join(baseDir, `${prefix}-${uuidv4()}-`));

  try {
    writeJob(workDir, { files, compile, run, testCases });
    const timeout = LIMITS.compileMs + testCases.length * (LIMITS.timeMs + 1000) + 15000;
    const { stdout, exitCode } = await dockerRun(sandboxCommand(image, workDir), timeout);
    if (exitCode === 2) throw new Error("Judge could not read its job configuration");

    let report;
    try {
      report = JSON.parse(stdout);
    } catch {
      // cl-meter never finished its report: the program took it down
      return { status: "runtime_error", output: null, error: "The program stopped the judge before it finished", time: 0, memory: 0, resources: null };
    }
    return verdictFrom(report, testCases);
  } finally {
    fs.rmSync(workDir, { recursive: true, force: true });
  }
}

module.exports = { judge, verdictFrom, LIMITS };
