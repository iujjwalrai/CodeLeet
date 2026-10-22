const { judge } = require("./judge");

module.exports = async function runJava({
  userCode,
  driverCode,
  testCases,
}) {
  return judge({
    // Sandbox image. Overridable so production can run versioned registry images.
    image: process.env.SANDBOX_IMAGE_JAVA || "codeleet-java",
    prefix: "java",
    files: { "Solution.java": userCode, "Main.java": driverCode },
    compile: "cp /app/Main.java /app/Solution.java . && javac Main.java Solution.java",
    run: "java -Xmx180m -Xss512k -XX:MaxMetaspaceSize=64m Main",
    testCases,
  });
};
