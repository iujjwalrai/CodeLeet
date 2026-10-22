const Problem = require("../models/Problem");
const { loadPackage, packageDirs, PackageError } = require("./package");
const { buildProblem, BuildError } = require("./build");
const { selfTest } = require("./selftest");

/*
 * Seeds problems from their packages: checks the driver runtimes, loads and
 * builds every package, and only then writes. One bad package means
 * nothing is written.
 *
 * Problems are matched by slug, so an existing problem keeps its _id (past
 * submissions still point at it) and its stats. Problems in the database
 * without a package are left alone.
 */
async function seedProblems({ execute, only = [], dryRun = false, root, log = console.log }) {
  await selfTest({ execute });
  log("Driver runtimes: C++ and Java read and write every type the same way");

  let dirs = packageDirs(root);
  if (only.length) {
    const unknown = only.filter((slug) => !dirs.some((d) => d.endsWith(`/${slug}`)));
    if (unknown.length) throw new Error(`No package named ${unknown.join(", ")}`);
    dirs = dirs.filter((d) => only.some((slug) => d.endsWith(`/${slug}`)));
  }

  // Load all first so every package's validation errors show at once
  const packages = [];
  const failures = [];
  for (const dir of dirs) {
    try {
      packages.push(loadPackage(dir));
    } catch (err) {
      if (!(err instanceof PackageError)) throw err;
      failures.push(err.message);
    }
  }
  if (failures.length) throw new Error(`Invalid packages:\n${failures.join("\n")}`);

  const built = [];
  for (const pkg of packages) {
    try {
      const { doc, summary } = await buildProblem(pkg, { execute });
      built.push(doc);
      const java = summary.javaMs === null ? "" : `, Java ${summary.javaMs} ms`;
      log(`  ok  ${pkg.slug}: ${summary.tests} tests (${summary.generated} generated), ` +
        `${(summary.bytes / 1024).toFixed(0)} KB, limit ${pkg.meta.timeLimitMs} ms, reference C++ ${summary.cppMs} ms${java}`);
    } catch (err) {
      if (!(err instanceof BuildError)) throw err;
      failures.push(err.message);
      log(`  FAIL ${err.message}`);
    }
  }
  if (failures.length) throw new Error(`${failures.length} package(s) failed; nothing was written`);

  if (dryRun) {
    log(`Dry run: ${built.length} problem(s) checked, nothing written`);
    return { written: 0, checked: built.length };
  }
  for (const doc of built) await upsertProblem(doc);
  log(`Wrote ${built.length} problem(s)`);
  return { written: built.length, checked: built.length };
}

function upsertProblem(doc) {
  return Problem.updateOne({ slug: doc.slug }, { $set: doc }, { upsert: true, runValidators: true });
}

module.exports = { seedProblems, upsertProblem };
