const { judge } = require("./judge");

module.exports = async function runCpp({
  userCode,
  driverCode,
  testCases,
}) {
  return judge({
    // Sandbox image. Overridable so production can run versioned registry images.
    image: process.env.SANDBOX_IMAGE_CPP || "codeleet-cpp",
    prefix: "cpp",
    files: { "Solution.cpp": userCode, "Main.cpp": driverCode },
    compile: "cp /app/Main.cpp /app/Solution.cpp . && g++ -std=c++17 -O2 Main.cpp Solution.cpp -o main",
    run: "./main",
    testCases,
  });
};
