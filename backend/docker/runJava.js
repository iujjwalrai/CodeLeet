const fs = require("fs");
const path = require("path");
const { exec } = require("child_process");
const { performance } = require("perf_hooks");
const { v4: uuidv4 } = require("uuid");

module.exports = async function runJava({
  userCode,
  driverCode,
  testCases,
}) {
  // console.log(userCode);
  // console.log(driverCode);
  // console.log(testCases);
  if (!Array.isArray(testCases) || testCases.length === 0) {
    throw new Error("No test cases provided");
  }

  const baseDir = path.join(process.cwd(), "tmp");
  if (!fs.existsSync(baseDir)) {
    fs.mkdirSync(baseDir);
  }

  const jobId = uuidv4();
  const workDir = fs.mkdtempSync(path.join(baseDir, `java-${jobId}-`));

  // Write files
  fs.writeFileSync(path.join(workDir, "Solution.java"), userCode);
  fs.writeFileSync(path.join(workDir, "Main.java"), driverCode);

  const compileCmd = `
docker run --rm \
  --cpus="1.0" \
  --memory="256m" \
  --network none \
  -v "${workDir}:/app" \
  codeleet-java \
  sh -c "cd /app && javac Main.java Solution.java"
`;

  const start = performance.now();

  try {
    /* ================= COMPILE ================= */
    await execPromise(compileCmd, 3000);

    /* ================= RUN TEST CASES ================= */
    for (const tc of testCases) {
      const runCmd = `
        docker run --rm -i \
          --cpus="1.0" \
          --memory="256m" \
          --network none \
          -v "${workDir}:/app" \
          codeleet-java \
          sh -c "cd /app && java Main"
        `;

      const { stdout } = await execPromise(runCmd, 3000, tc.input);

      if (stdout.trim() !== tc.output.trim()) {
        cleanup(workDir);
        return {
          status: "wrong_answer",
          output: stdout.trim(),
          failedTestCase: tc,
          error: `Expected: ${tc.output}, Got: ${stdout.trim()}`,
          time: Math.round(performance.now() - start),
        };
      }
    }

    cleanup(workDir);
    return {
      status: "accepted",
      output: "All test cases passed",
      error: null,
      time: Math.round(performance.now() - start),
    };

  } catch (err) {
    cleanup(workDir);

    const msg = err.message || "";

    return {
      status: msg.includes("javac")
        ? "compilation_error"
        : "runtime_error",
      output: null,
      error: msg,
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
