const fs = require("fs");
const path = require("path");
const { exec } = require("child_process");
const { performance } = require("perf_hooks");
const { v4: uuidv4 } = require("uuid");

module.exports = async function runCpp({
  userCode,
  driverCode,
  testCases,
}) {
  if (!Array.isArray(testCases) || testCases.length === 0) {
    throw new Error("No test cases provided");
  }

  const baseDir = path.join(process.cwd(), "tmp");
  if (!fs.existsSync(baseDir)) {
    fs.mkdirSync(baseDir);
  }

  const jobId = uuidv4();
  const workDir = fs.mkdtempSync(path.join(baseDir, `cpp-${jobId}-`));

  /* ================= WRITE FILES ================= */
  fs.writeFileSync(path.join(workDir, "Solution.cpp"), userCode);
  fs.writeFileSync(path.join(workDir, "Main.cpp"), driverCode);

  // Compile: workDir mounted rw so g++ can write the binary directly to /app.
  const compileCmd = `
docker run --rm \
  --cpus="1.0" \
  --memory="256m" \
  --memory-swap="256m" \
  --network none \
  --pids-limit 64 \
  --ulimit nproc=64:64 \
  --ulimit nofile=64:64 \
  --ulimit fsize=10485760 \
  --cap-drop ALL \
  --security-opt no-new-privileges \
  --read-only \
  --tmpfs /tmp:rw,nosuid,size=32m \
  --user nobody \
  -v "${workDir}:/app" \
  codeleet-cpp \
  sh -c "cp /app/*.cpp /tmp/ && cd /tmp && g++ -std=c++17 Main.cpp Solution.cpp -O2 -o /app/main"
`;

  const start = performance.now();

  try {
    /* ================= COMPILE ================= */
    await execPromise(compileCmd, 3000);

    /* ================= RUN TEST CASES ================= */
    let passedCount = 0;
    let failedTestCase = null;
    let failedTestCaseIndex = -1;
    let failedOutput = null;

    for (let i = 0; i < testCases.length; i++) {
      const tc = testCases[i];
      // Run: workDir is read-only; copy the binary into tmpfs (with exec allowed) to run it.
      const runCmd = `
docker run --rm -i \
  --cpus="1.0" \
  --memory="256m" \
  --memory-swap="256m" \
  --network none \
  --pids-limit 64 \
  --ulimit nproc=64:64 \
  --ulimit nofile=64:64 \
  --ulimit fsize=10485760 \
  --cap-drop ALL \
  --security-opt no-new-privileges \
  --read-only \
  --tmpfs /tmp:rw,nosuid,size=32m \
  --user nobody \
  -v "${workDir}:/app:ro" \
  codeleet-cpp \
  sh -c "cp /app/main /tmp/ && chmod +x /tmp/main && cd /tmp && ./main"
`;

      const { stdout } = await execPromise(runCmd, 3000, tc.input);

      if (stdout.trim() === tc.output.trim()) {
        passedCount++;
      } else if (failedTestCase === null) {
        failedTestCase = tc;
        failedTestCaseIndex = i;
        failedOutput = stdout.trim();
      }
    }

    cleanup(workDir);

    if (failedTestCase === null) {
      return {
        status: "accepted",
        output: "All test cases passed",
        passedCount: testCases.length,
        totalCount: testCases.length,
        error: null,
        time: Math.round(performance.now() - start),
      };
    } else {
      return {
        status: "wrong_answer",
        output: failedOutput,
        passedCount,
        totalCount: testCases.length,
        failedTestCase,
        failedTestCaseIndex,
        error: `Expected: ${failedTestCase.output}, Got: ${failedOutput}`,
        time: Math.round(performance.now() - start),
      };
    }

  } catch (err) {
    cleanup(workDir);

    const raw = err.message || "";
    const cleanError = raw
      .replace(/^Command failed:[\s\S]*?\n\n/, "")
      .replace(/^Command failed:[^\n]*\n?/, "")
      .trim();

    return {
      status: cleanError.includes("g++") || cleanError.includes(".cpp") || raw.includes("g++")
        ? "compilation_error"
        : "runtime_error",
      output: null,
      error: cleanError || "Unknown error",
      time: Math.round(performance.now() - start),
    };
  }
};

/* ================= HELPERS ================= */

function execPromise(cmd, timeout, stdin = null) {
  return new Promise((resolve, reject) => {
    const child = exec(cmd, { timeout }, (err, stdout, stderr) => {
      if (err) return reject(err);
      if (stderr) return reject(new Error(stderr));
      resolve({ stdout });
    });

    if (stdin !== null) {
      child.stdin.write(stdin);
      child.stdin.end();
    }
  });
}

function cleanup(dir) {
  fs.rmSync(dir, { recursive: true, force: true });
}
