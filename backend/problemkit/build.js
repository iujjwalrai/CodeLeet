const { cppJob } = require("../docker/runCpp");
const { javaJob } = require("../docker/runJava");
const { checkGeneratedLine } = require("./types");
const { generatorSource } = require("./codegen");
const { buildAnalysisTools } = require("./counterexample");

/*
 * Turns a loaded package (package.js) into a Problem document: generates the
 * big test inputs, judges the reference solution(s) on every test, and takes
 * the reference's answers as the generated tests' outputs. Throws BuildError
 * if anything doesn't hold.
 *
 * `execute` is docker/judge.js's execute, passed in so tests can fake it.
 */

// Test data per problem, stored in Mongo and copied into every judging job
const MAX_TEST_BYTES = 2 * 1024 * 1024;
// The time limit must be at least this many times the slowest reference run,
// so correct solutions that are a bit slower than the reference still pass
const REFERENCE_HEADROOM = 5;

class BuildError extends Error {
  constructor(slug, message) {
    super(`${slug}: ${message}`);
    this.slug = slug;
  }
}

const firstLine = (text) => (text || "").trim().split("\n")[0].slice(0, 200);

async function generateInputs(pkg, gens, execute) {
  const job = {
    image: cppJob({}).image,
    prefix: "gen",
    files: { "generator.cpp": generatorSource(pkg.generator) },
    compile: "cp /app/generator.cpp . && g++ -std=c++17 -O2 generator.cpp -o gen",
    run: "./gen",
    inputs: gens.map((t) => `${t.gen[0]} ${t.gen[1]}\n`),
  };

  // Twice, to catch a generator that doesn't depend only on (n, seed)
  const runs = [];
  for (let k = 0; k < 2; k++) {
    const report = await execute(job);
    if (!report) throw new BuildError(pkg.slug, "generator stopped the judge");
    if (!report.compile.ok) throw new BuildError(pkg.slug, `generator does not compile:\n${report.compile.log}`);
    runs.push(report.tests);
  }

  return gens.map((t, i) => {
    const [a, b] = [runs[0][i], runs[1][i]];
    const where = `generator with n=${t.gen[0]} seed=${t.gen[1]}`;
    if (!a || a.tle || a.mle || a.signal || a.exit !== 0) {
      throw new BuildError(pkg.slug, `${where} failed: ${a ? firstLine(a.stderr) || `exit ${a.exit}` : "did not run"}`);
    }
    if (a.stdoutTruncated) throw new BuildError(pkg.slug, `${where} printed more than 4 MB`);
    if (a.stdout !== b.stdout) throw new BuildError(pkg.slug, `${where} printed different input on a second run`);
    const lines = a.stdout.trimEnd().split("\n");
    if (lines.length !== pkg.signature.params.length) {
      throw new BuildError(pkg.slug, `${where} printed ${lines.length} line(s), expected one per parameter (${pkg.signature.params.length})`);
    }
    lines.forEach((line, j) => {
      const p = pkg.signature.params[j];
      const e = checkGeneratedLine(p.type, line);
      if (e) throw new BuildError(pkg.slug, `${where}: ${p.name} ${e}`);
    });
    return lines.join("\n");
  });
}

/* Judges a reference on every test; returns its outputs and slowest time */
async function runReference(pkg, language, job, tests, execute) {
  const report = await execute({ ...job, inputs: tests.map((t) => t.input) });
  if (!report) throw new BuildError(pkg.slug, `${language} reference stopped the judge`);
  if (!report.compile.ok) throw new BuildError(pkg.slug, `${language} reference does not compile:\n${report.compile.log}`);

  let slowest = 0;
  const outputs = tests.map((t, i) => {
    const r = report.tests[i];
    const where = `${language} reference on test ${i + 1}`;
    if (!r) throw new BuildError(pkg.slug, `${where} did not run`);
    if (r.tle) throw new BuildError(pkg.slug, `${where} hit the time limit`);
    if (r.mle) throw new BuildError(pkg.slug, `${where} hit the memory limit`);
    if (r.signal || r.exit !== 0) throw new BuildError(pkg.slug, `${where} crashed: ${firstLine(r.stderr) || `exit ${r.exit}, signal ${r.signal}`}`);
    slowest = Math.max(slowest, r.wallMs);
    const out = r.stdout.trim();
    if (t.output !== undefined && out !== t.output) {
      throw new BuildError(pkg.slug, `${where}: expected ${firstLine(t.output)}, got ${firstLine(out)}`);
    }
    return out;
  });
  const limit = pkg.meta.timeLimitMs;
  if (slowest * REFERENCE_HEADROOM > limit) {
    throw new BuildError(pkg.slug, `${language} reference takes up to ${Math.round(slowest)} ms; ` +
      `timeLimitMs (${limit}) must be at least ${REFERENCE_HEADROOM}x that`);
  }
  return { outputs, slowest: Math.round(slowest) };
}

async function buildProblem(pkg, { execute }) {
  const tests = pkg.tests.map((t) => ({ ...t }));

  const gens = tests.filter((t) => t.gen);
  if (gens.length) {
    const inputs = await generateInputs(pkg, gens, execute);
    gens.forEach((t, i) => { t.input = inputs[i]; });
  }

  const cpp = await runReference(pkg, "cpp", cppJob({ userCode: pkg.reference.cpp, driverCode: pkg.templates.cpp.driver }), tests, execute);
  tests.forEach((t, i) => { if (t.output === undefined) t.output = cpp.outputs[i]; });

  let java = null;
  if (pkg.reference.java) {
    java = await runReference(pkg, "java", javaJob({ userCode: pkg.reference.java, driverCode: pkg.templates.java.driver }), tests, execute);
  }

  const testCases = tests.map(({ input, output, hidden }) => ({ input, output, hidden }));
  const bytes = testCases.reduce((n, t) => n + Buffer.byteLength(t.input) + Buffer.byteLength(t.output), 0);
  if (bytes > MAX_TEST_BYTES) {
    throw new BuildError(pkg.slug, `tests take ${(bytes / 1048576).toFixed(2)} MB; the limit is ${MAX_TEST_BYTES / 1048576} MB`);
  }

  return {
    doc: { ...pkg.meta, testCases, codeTemplates: pkg.templates, analysisTools: buildAnalysisTools(pkg) },
    summary: {
      tests: testCases.length,
      generated: gens.length,
      cppMs: cpp.slowest,
      javaMs: java ? java.slowest : null,
      bytes,
    },
  };
}

module.exports = { buildProblem, BuildError, MAX_TEST_BYTES, REFERENCE_HEADROOM };
