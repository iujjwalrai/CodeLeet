const fs = require("fs");
const path = require("path");
const { TYPES, encode, checkValue } = require("./types");
const codegen = require("./codegen");

/*
 * A problem package is a folder named after its slug, in backend/problems/
 * by default. Packages hold hidden tests and reference solutions, so that
 * folder is not tracked in git or copied into images (see README.md):
 *
 *   problem.json     title, difficulty, topics, description, constraints,
 *                    function { name, params: [{ name, type }], returns },
 *                    examples [{ args, output, explanation? }],
 *                    timeLimitMs? (per test, default 1000)
 *   tests.json       { tests: [{ args, output, hidden? } | { gen: [n, seed], hidden? }] }
 *   reference.cpp    a correct Solution, written as a user would
 *   reference.java   optional; also judged when present
 *   generator.cpp    void generate(long long n, Rng& rng), see runtime/gen.hpp
 *
 * Optional hand-written replacements for the generated code:
 *   cpp/driver.cpp, cpp/starter.cpp, java/Main.java, java/Starter.java
 *
 * Examples are judged too, as the first (visible) tests. Other tests are
 * hidden unless they say otherwise. A generated test's input comes from the
 * generator and its output from the reference (see build.js).
 */

const PROBLEMS_DIR = path.join(__dirname, "..", "problems");
const TOPICS = require("./topics.json");

const DIFFICULTIES = ["Easy", "Medium", "Hard"];
const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const IDENT = /^[A-Za-z_][A-Za-z0-9_]*$/;
const PROBLEM_KEYS = ["title", "difficulty", "topics", "description", "constraints", "function", "examples", "timeLimitMs"];
const DEFAULT_TIME_LIMIT_MS = 1000;

class PackageError extends Error {
  constructor(slug, problems) {
    super(`${slug}:\n${problems.map((p) => `  - ${p}`).join("\n")}`);
    this.slug = slug;
    this.problems = problems;
  }
}

const isText = (v) => typeof v === "string" && v.trim().length > 0;

function readJson(dir, file, errors) {
  try {
    return JSON.parse(fs.readFileSync(path.join(dir, file), "utf8"));
  } catch (err) {
    errors.push(`${file}: ${err.code === "ENOENT" ? "missing" : err.message}`);
    return null;
  }
}

function readText(dir, file, errors, { required = true } = {}) {
  const p = path.join(dir, file);
  if (!fs.existsSync(p)) {
    if (required) errors.push(`${file}: missing`);
    return null;
  }
  return fs.readFileSync(p, "utf8");
}

function checkSignature(fn, errors) {
  if (!fn || typeof fn !== "object") return errors.push("problem.json: function is missing");
  if (!IDENT.test(fn.name || "")) errors.push(`problem.json: function.name "${fn.name}" is not an identifier`);
  if (!TYPES[fn.returns]) errors.push(`problem.json: function.returns "${fn.returns}" is not a known type`);
  if (!Array.isArray(fn.params) || fn.params.length === 0) return errors.push("problem.json: function.params must list at least one parameter");
  const seen = new Set();
  fn.params.forEach((p, i) => {
    if (!IDENT.test(p.name || "")) errors.push(`problem.json: function.params[${i}].name "${p.name}" is not an identifier`);
    if (seen.has(p.name)) errors.push(`problem.json: function.params[${i}].name "${p.name}" is repeated`);
    seen.add(p.name);
    if (!TYPES[p.type]) errors.push(`problem.json: function.params[${i}].type "${p.type}" is not a known type`);
  });
}

/* Checks hand-written args and output against the signature */
function checkCase(where, c, fn, errors) {
  if (!Array.isArray(c.args) || c.args.length !== fn.params.length) {
    return errors.push(`${where}.args must have ${fn.params.length} value(s), one per parameter`);
  }
  c.args.forEach((v, i) => {
    const e = checkValue(fn.params[i].type, v);
    if (e) errors.push(`${where}.args[${i}] (${fn.params[i].name}) ${e}`);
  });
  if (!("output" in c)) return errors.push(`${where}.output is missing`);
  const e = checkValue(fn.returns, c.output);
  if (e) errors.push(`${where}.output ${e}`);
}

const inputOf = (args) => args.map(encode).join("\n");

/* How an example's input reads on the problem page: nums = [1,2,3] */
const displayInput = (args, fn) => args.map((v, i) => `${fn.params[i].name} = ${encode(v)}`).join("\n");

/* Reads and validates one package. Throws PackageError listing every problem found. */
function loadPackage(dir) {
  const slug = path.basename(dir);
  const errors = [];
  if (!SLUG.test(slug)) errors.push(`folder name "${slug}" is not a valid slug`);

  const problem = readJson(dir, "problem.json", errors) || {};
  const testsFile = readJson(dir, "tests.json", errors) || {};
  const reference = {
    cpp: readText(dir, "reference.cpp", errors),
    java: readText(dir, "reference.java", errors, { required: false }),
  };
  const generator = readText(dir, "generator.cpp", errors);

  for (const key of Object.keys(problem)) {
    if (!PROBLEM_KEYS.includes(key)) errors.push(`problem.json: unknown key "${key}"`);
  }
  if (!isText(problem.title)) errors.push("problem.json: title is missing");
  if (!DIFFICULTIES.includes(problem.difficulty)) errors.push(`problem.json: difficulty must be one of ${DIFFICULTIES.join(", ")}`);
  if (!Array.isArray(problem.topics) || problem.topics.length === 0) {
    errors.push("problem.json: topics must list at least one topic");
  } else {
    for (const t of problem.topics) {
      if (!TOPICS.includes(t)) errors.push(`problem.json: topic "${t}" is not in problemkit/topics.json`);
    }
  }
  if (!isText(problem.description)) errors.push("problem.json: description is missing");
  const timeLimitMs = problem.timeLimitMs ?? DEFAULT_TIME_LIMIT_MS;
  if (!Number.isInteger(timeLimitMs) || timeLimitMs < 100 || timeLimitMs > 10000) {
    errors.push("problem.json: timeLimitMs must be a whole number of ms from 100 to 10000");
  }
  if (!Array.isArray(problem.constraints) || !problem.constraints.every(isText)) {
    errors.push("problem.json: constraints must be a list of strings");
  }

  // Examples and tests can only be checked against a valid signature
  const fn = problem.function;
  const signatureErrors = [];
  checkSignature(fn, signatureErrors);
  errors.push(...signatureErrors);
  const signatureOk = signatureErrors.length === 0;

  if (!Array.isArray(problem.examples) || problem.examples.length === 0) {
    errors.push("problem.json: examples must list at least one example");
  } else if (signatureOk) {
    problem.examples.forEach((ex, i) => {
      checkCase(`problem.json: examples[${i}]`, ex, fn, errors);
      if (ex.explanation !== undefined && !isText(ex.explanation)) errors.push(`problem.json: examples[${i}].explanation must be text`);
    });
  }

  const tests = [];
  if (!Array.isArray(testsFile.tests)) {
    errors.push("tests.json: must be { \"tests\": [...] }");
  } else if (signatureOk) {
    testsFile.tests.forEach((t, i) => {
      const where = `tests.json: tests[${i}]`;
      if (t.hidden !== undefined && typeof t.hidden !== "boolean") errors.push(`${where}.hidden must be true or false`);
      const hidden = t.hidden !== false;
      if ("gen" in t) {
        const ok = Array.isArray(t.gen) && t.gen.length === 2 && t.gen.every((x) => Number.isSafeInteger(x) && x >= 0);
        if (!ok) errors.push(`${where}.gen must be [n, seed] with whole numbers >= 0`);
        if ("args" in t || "output" in t) errors.push(`${where} has gen, so it can't also have args or output`);
        tests.push({ gen: t.gen, hidden });
      } else {
        checkCase(where, t, fn, errors);
        if (Array.isArray(t.args)) tests.push({ input: inputOf(t.args), output: encode(t.output), hidden });
      }
    });
  }

  if (errors.length) throw new PackageError(slug, errors);

  const override = (file) => readText(dir, file, [], { required: false });
  const examples = problem.examples.map((ex) => ({
    input: displayInput(ex.args, fn),
    output: encode(ex.output),
    ...(ex.explanation ? { explanation: ex.explanation } : {}),
  }));

  return {
    slug,
    signature: fn,
    meta: {
      title: problem.title,
      slug,
      difficulty: problem.difficulty,
      topics: problem.topics,
      description: problem.description,
      constraints: problem.constraints,
      examples,
      timeLimitMs,
    },
    // Examples first and visible, so Run shows them as the first cases
    tests: [
      ...problem.examples.map((ex) => ({ input: inputOf(ex.args), output: encode(ex.output), hidden: false })),
      ...tests,
    ],
    reference,
    generator,
    templates: {
      cpp: {
        starter: override("cpp/starter.cpp") ?? codegen.cppStarter(fn),
        driver: override("cpp/driver.cpp") ?? codegen.cppDriver(fn),
      },
      java: {
        starter: override("java/Starter.java") ?? codegen.javaStarter(fn),
        driver: override("java/Main.java") ?? codegen.javaDriver(fn),
      },
    },
  };
}

/* Every package folder in root, sorted by slug */
function packageDirs(root = PROBLEMS_DIR) {
  if (!fs.existsSync(root)) throw new Error(`No problem packages folder at ${root}`);
  return fs
    .readdirSync(root, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => path.join(root, d.name))
    .sort();
}

module.exports = { loadPackage, packageDirs, PackageError, TOPICS, PROBLEMS_DIR };
