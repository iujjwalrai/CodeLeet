// /docker/runPython.js
const fs = require("fs");
const path = require("path");
const { exec } = require("child_process");
const { performance } = require("perf_hooks");
const { v4: uuid } = require("uuid");

// Python wrapper that enforces CPU-time and memory limits from *inside* the
// interpreter — a second layer of defence on top of Docker resource flags.
const PYTHON_RESOURCE_WRAPPER = `
import resource, sys, os

# CPU time limit: 5 seconds (SIGKILL after)
resource.setrlimit(resource.RLIMIT_CPU, (5, 5))
# Address-space limit: 200 MB
resource.setrlimit(resource.RLIMIT_AS, (200 * 1024 * 1024, 200 * 1024 * 1024))
# Max file size a process may create: 1 MB
resource.setrlimit(resource.RLIMIT_FSIZE, (1 * 1024 * 1024, 1 * 1024 * 1024))
# Max number of open file descriptors
resource.setrlimit(resource.RLIMIT_NOFILE, (32, 32))

# Disable writing to /proc, /sys, network sockets, etc. at OS level
# (belt-and-suspenders; Docker already blocks network + read-only FS)

exec(open('/tmp/main.py').read(), {'__name__': '__main__'})
`;

module.exports = async function runPython({ userCode, testCases }) {
  const { performance: perf } = require("perf_hooks");

  if (!Array.isArray(testCases) || testCases.length === 0) {
    throw new Error("No test cases provided");
  }

  const id = uuid();
  const baseDir = path.join(process.cwd(), "tmp");
  if (!fs.existsSync(baseDir)) {
    fs.mkdirSync(baseDir, { mode: 0o777 });
  } else {
    fs.chmodSync(baseDir, 0o777);
  }

  const workDir = fs.mkdtempSync(path.join(baseDir, `py-${id}-`));
  fs.chmodSync(workDir, 0o777);

  fs.writeFileSync(path.join(workDir, "main.py"), userCode, { mode: 0o666 });
  fs.writeFileSync(path.join(workDir, "runner.py"), PYTHON_RESOURCE_WRAPPER, { mode: 0o666 });

  const start = perf.now();

  try {
    const results = [];

    for (const tc of testCases) {
      const runCmd = `
docker run --rm -i \\
  --cpus="0.5" \\
  --memory="128m" \\
  --memory-swap="128m" \\
  --network none \\
  --pids-limit 32 \\
  --ulimit nproc=32:32 \\
  --ulimit nofile=32:32 \\
  --ulimit fsize=1048576 \\
  --cap-drop ALL \\
  --security-opt no-new-privileges \\
  --read-only \\
  --tmpfs /tmp:rw,noexec,nosuid,size=16m \\
  --user nobody \\
  -v "${workDir}:/app:ro" \\
  python:3.12-alpine \\
  sh -c "cp /app/main.py /app/runner.py /tmp/ && python3 /tmp/runner.py"
`.trim();

      const { stdout } = await execPromise(runCmd, 5000, tc.input);

      if (stdout.trim() !== tc.output.trim()) {
        cleanup(workDir);
        return {
          status: "wrong_answer",
          output: stdout.trim(),
          failedTestCase: tc,
          error: `Expected: ${tc.output}, Got: ${stdout.trim()}`,
          time: Math.round(perf.now() - start),
        };
      }
    }

    cleanup(workDir);
    return {
      status: "accepted",
      output: "All test cases passed",
      error: null,
      time: Math.round(perf.now() - start),
    };

  } catch (err) {
    cleanup(workDir);
    const raw = err.message || "";
    const cleanError = raw
      .replace(/^Command failed:[\s\S]*?\n\n/, "")
      .replace(/^Command failed:[^\n]*\n?/, "")
      .trim();

    return {
      status: "runtime_error",
      output: null,
      error: cleanError || "Unknown error",
      time: Math.round(perf.now() - start),
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
