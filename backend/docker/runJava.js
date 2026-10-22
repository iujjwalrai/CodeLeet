const { judge } = require("./judge");

/* How a Java submission is built and run; the seed script runs references the same way */
function javaJob({ userCode, driverCode }) {
  return {
    // Sandbox image. Overridable so production can run versioned registry images.
    image: process.env.SANDBOX_IMAGE_JAVA || "codeleet-java",
    prefix: "java",
    files: { "Solution.java": userCode, "Main.java": driverCode },
    compile: "cp /app/Main.java /app/Solution.java . && javac Main.java Solution.java",
    run: "java -Xmx180m -Xss512k -XX:MaxMetaspaceSize=64m Main",
  };
}

async function runJava({ userCode, driverCode, testCases, timeLimitMs }) {
  return judge({ ...javaJob({ userCode, driverCode }), testCases, timeMs: timeLimitMs });
}

module.exports = runJava;
module.exports.javaJob = javaJob;
