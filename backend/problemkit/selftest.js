const { cppJob } = require("../docker/runCpp");
const { javaJob } = require("../docker/runJava");
const { cppEchoDriver, javaEchoDriver } = require("./codegen");
const { TYPES } = require("./types");

/*
 * Checks that the C++ and Java runtimes read every type and print it back
 * exactly as JSON.stringify would. [type, input, expected output]; the
 * expected output is the input unless the input isn't in canonical form.
 */
const SAMPLES = [
  ["int", "-2147483648"],
  ["int", "2147483647"],
  ["long", "-9223372036854775808"],
  ["long", "9223372036854775807"],
  ["bool", "true"],
  ["bool", "false"],
  ["string", '""'],
  ["string", '"a \\"quoted\\" \\\\ back/slash"'],
  ["string", '"esc\\/aped \\u0041"', '"esc/aped A"'],
  ["int[]", "[]"],
  ["int[]", "[ 1 , -2,\t3 ]", "[1,-2,3]"],
  ["long[]", "[9223372036854775807,-1,0]"],
  ["string[]", "[]"],
  ["string[]", '["","a b","x"]'],
  ["int[][]", "[]"],
  ["int[][]", "[[],[1],[2,3]]"],
  ["char[][]", '["10","01"]'],
  ["char[][]", "[]"],
  ["List<int>", "[]"],
  ["List<int>", "[4,-5]"],
  ["List<string>", '["a","b c"]'],
  ["List<List<int>>", "[]"],
  ["List<List<int>>", "[[1,2],[],[3]]"],
  ["ListNode", "[]"],
  ["ListNode", "[1,2,3]"],
  ["TreeNode", "[]"],
  ["TreeNode", "[3,9,20,null,null,15,7]"],
  ["TreeNode", "[1,null,2,null,3]"],
  ["TreeNode", "[1,2,null]", "[1,2]"],
];

async function selfTest({ execute }) {
  const missing = Object.keys(TYPES).filter((t) => !SAMPLES.some(([type]) => type === t));
  if (missing.length) throw new Error(`Self-test has no sample for ${missing.join(", ")}`);

  const types = SAMPLES.map(([type]) => type);
  const input = SAMPLES.map(([, text]) => text).join("\n");
  const expected = SAMPLES.map(([, text, out = text]) => out);

  const jobs = [
    ["C++", cppJob({ userCode: "", driverCode: cppEchoDriver(types) })],
    ["Java", javaJob({ userCode: "", driverCode: javaEchoDriver(types) })],
  ];
  for (const [language, job] of jobs) {
    const report = await execute({ ...job, inputs: [input] });
    if (!report?.compile?.ok) {
      throw new Error(`${language} runtime does not compile:\n${report?.compile?.log || "no report"}`);
    }
    const t = report.tests[0];
    if (t.exit !== 0 || t.signal) throw new Error(`${language} runtime failed:\n${t.stderr}`);
    const lines = t.stdout.replace(/\n$/, "").split("\n");
    expected.forEach((want, i) => {
      if (lines[i] !== want) {
        throw new Error(`${language} runtime: ${SAMPLES[i][0]} ${SAMPLES[i][1]} printed ${lines[i]}, expected ${want}`);
      }
    });
  }
}

module.exports = { selfTest, SAMPLES };
