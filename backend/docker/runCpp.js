const { judge } = require("./judge");

/* How a C++ submission is built and run; the seed script runs references the same way */
function cppJob({ userCode, driverCode }) {
  return {
    // Sandbox image. Overridable so production can run versioned registry images.
    image: process.env.SANDBOX_IMAGE_CPP || "codeleet-cpp",
    prefix: "cpp",
    files: { "Solution.cpp": userCode, "Main.cpp": driverCode },
    // Main.cpp (generated, see problemkit/codegen.js) includes Solution.cpp
    // after the headers and ListNode/TreeNode, so they compile as one unit.
    // A missing return is an error: at -O2 it would otherwise run into
    // whatever code follows and fail in confusing ways.
    compile: "cp /app/Main.cpp /app/Solution.cpp . && g++ -std=c++17 -O2 -Werror=return-type Main.cpp -o main",
    run: "./main",
  };
}

async function runCpp({ userCode, driverCode, testCases, timeLimitMs }) {
  const result = await judge({ ...cppJob({ userCode, driverCode }), testCases, timeMs: timeLimitMs });
  if (result.status === "compilation_error") {
    // Every message about the user's code starts here, since Main.cpp includes it
    result.error = result.error.replace(/^In file included from Main\.cpp:\d+:\n/gm, "");
  }
  return result;
}

module.exports = runCpp;
module.exports.cppJob = cppJob;
