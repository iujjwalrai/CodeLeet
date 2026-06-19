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

  // Compile: workDir mounted rw so javac output (.class files) can be written back to the host.
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
  codeleet-java \
  sh -c "cp /app/*.java /tmp/ && cd /tmp && javac Main.java Solution.java && cp /tmp/*.class /app/"
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
      // Run: workDir is read-only; copy compiled .class files into the tmpfs to execute.
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
  codeleet-java \
  sh -c "cp /app/*.class /tmp/ && cd /tmp && java -Xmx180m -Xss512k -XX:MaxMetaspaceSize=64m Main"
`;

      const { stdout } = await execPromise(runCmd, 3000, tc.input);

      if (stdout.trim() === tc.output.trim()) {
        passedCount++;
      } else if (failedTestCase === null) {
        // Record only the FIRST failure
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
    // Strip the "Command failed: \ndocker run ...\n\n" prefix — keep only compiler output
    const cleanError = raw
      .replace(/^Command failed:[\s\S]*?\n\n/, "") // remove up to first blank line
      .replace(/^Command failed:[^\n]*\n?/, "")     // fallback: remove first line if no blank line
      .trim();

    return {
      status: cleanError.includes("javac") || cleanError.includes(".java") || raw.includes("javac")
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
