const fs = require('fs');
const Problem = require('../../models/Problem');
const { loadPackage } = require('../../problemkit/package');
const { buildProblem, BuildError, MAX_TEST_BYTES } = require('../../problemkit/build');
const { seedProblems } = require('../../problemkit/seed');
const { useTestDb } = require('../helpers/db');
const { writePackage, tempRoot, fakeExecute, ok } = require('../helpers/problemPackages');

useTestDb();

let root;
beforeEach(() => { root = tempRoot(); });
afterEach(() => fs.rmSync(root, { recursive: true, force: true }));

const build = (dir, fake = fakeExecute()) => buildProblem(loadPackage(dir), { execute: fake.execute });
const failure = (promise) => promise.then(() => { throw new Error('expected a BuildError'); }, (err) => {
  expect(err).toBeInstanceOf(BuildError);
  return err.message;
});

describe('buildProblem', () => {
  it('fills generated tests from the generator and their outputs from the reference', async () => {
    const fake = fakeExecute();
    const { doc, summary } = await build(writePackage(root, 'double-it'), fake);

    expect(doc.testCases).toEqual([
      { input: '2', output: '4', hidden: false },
      { input: '-3', output: '-6', hidden: true },
      { input: '10001', output: '20002', hidden: true },
    ]);
    expect(doc).toMatchObject({ slug: 'double-it', title: 'Double It', timeLimitMs: 1000 });
    expect(doc.codeTemplates.cpp.driver).toContain('#include "Solution.cpp"');
    expect(summary).toMatchObject({ tests: 3, generated: 1, cppMs: 5, javaMs: null });

    // generator twice (determinism), then the C++ reference
    expect(fake.calls.map((j) => j.prefix)).toEqual(['gen', 'gen', 'cpp']);
    expect(fake.calls[0].inputs).toEqual(['10 1\n']);
  });

  it('also judges the Java reference when there is one', async () => {
    const fake = fakeExecute();
    const dir = writePackage(root, 'double-it', { files: { 'reference.java': 'class Solution {}' } });

    const { summary } = await build(dir, fake);

    expect(fake.calls.map((j) => j.prefix)).toEqual(['gen', 'gen', 'cpp', 'java']);
    expect(summary.javaMs).toBe(5);
  });

  it('fails when the reference disagrees with a hand-written output', async () => {
    const fake = fakeExecute({ solve: (input) => String(3 * Number(input)) });
    expect(await failure(build(writePackage(root, 'double-it'), fake)))
      .toBe('double-it: cpp reference on test 1: expected 4, got 6');
  });

  it('fails when the Java reference disagrees with the C++ one', async () => {
    const fake = fakeExecute({ tweak: (job, tests) => (job.prefix === 'java' ? tests.map(() => ok('0\n')) : tests) });
    const dir = writePackage(root, 'double-it', { files: { 'reference.java': 'class Solution {}' } });
    expect(await failure(build(dir, fake))).toBe('double-it: java reference on test 1: expected 4, got 0');
  });

  it('fails when the generator prints something different for the same n and seed', async () => {
    let run = 0;
    const fake = fakeExecute({ tweak: (job, tests) => (job.prefix === 'gen' && run++ === 1 ? [ok('7\n')] : tests) });
    expect(await failure(build(writePackage(root, 'double-it'), fake)))
      .toBe('double-it: generator with n=10 seed=1 printed different input on a second run');
  });

  it('fails when the generator prints the wrong number of arguments or bad values', async () => {
    const twoLines = fakeExecute({ tweak: (job, tests) => (job.prefix === 'gen' ? [ok('1\n2\n')] : tests) });
    expect(await failure(build(writePackage(root, 'double-it'), twoLines)))
      .toBe('double-it: generator with n=10 seed=1 printed 2 line(s), expected one per parameter (1)');

    const notInt = fakeExecute({ tweak: (job, tests) => (job.prefix === 'gen' ? [ok('"x"\n')] : tests) });
    expect(await failure(build(writePackage(root, 'double-it'), notInt)))
      .toBe('double-it: generator with n=10 seed=1: x is not a valid int: "x"');
  });

  it('fails when the reference crashes or hits a limit', async () => {
    const crash = fakeExecute({ tweak: (job, tests) => (job.prefix === 'cpp' ? tests.map((t) => ({ ...t, exit: 1, stderr: 'boom\nmore' })) : tests) });
    expect(await failure(build(writePackage(root, 'double-it'), crash))).toBe('double-it: cpp reference on test 1 crashed: boom');

    const tle = fakeExecute({ tweak: (job, tests) => (job.prefix === 'cpp' ? tests.map((t) => ({ ...t, tle: true })) : tests) });
    expect(await failure(build(writePackage(root, 'double-it'), tle))).toBe('double-it: cpp reference on test 1 hit the time limit');
  });

  it('fails when the time limit leaves less than 5x room over the reference', async () => {
    const slow = fakeExecute({ tweak: (job, tests) => (job.prefix === 'cpp' ? tests.map((t) => ({ ...t, wallMs: 250 })) : tests) });
    expect(await failure(build(writePackage(root, 'double-it'), slow)))
      .toBe('double-it: cpp reference takes up to 250 ms; timeLimitMs (1000) must be at least 5x that');

    const roomy = writePackage(root, 'roomy', { problem: { timeLimitMs: 1250 } });
    await expect(build(roomy, slow)).resolves.toBeDefined();
  });

  it('fails when the tests take more than 2 MB', async () => {
    // A string answer: "x" for the example, 2 MB of x for the generated test
    const dir = writePackage(root, 'wordy', {
      problem: {
        function: { name: 'f', params: [{ name: 'x', type: 'int' }], returns: 'string' },
        examples: [{ args: [2], output: 'x' }],
      },
      tests: { tests: [{ gen: [1, 1] }] },
    });
    const big = fakeExecute({ solve: (input) => (input === '2' ? '"x"' : `"${'x'.repeat(MAX_TEST_BYTES)}"`) });
    expect(await failure(build(dir, big))).toBe('wordy: tests take 2.00 MB; the limit is 2 MB');
  });
});

describe('seedProblems', () => {
  const quiet = () => {};

  it('checks the runtimes, then writes every package', async () => {
    writePackage(root, 'alpha');
    writePackage(root, 'beta', { problem: { title: 'Beta' } });
    const fake = fakeExecute();

    const result = await seedProblems({ execute: fake.execute, root, log: quiet });

    expect(result).toEqual({ written: 2, checked: 2 });
    // The first two jobs are the C++ and Java echo self-test
    expect(fake.calls.slice(0, 2).map((j) => j.prefix)).toEqual(['cpp', 'java']);
    const stored = await Problem.find().select(Problem.JUDGING_FIELDS).sort('slug').lean();
    expect(stored.map((p) => p.slug)).toEqual(['alpha', 'beta']);
    expect(stored[1]).toMatchObject({ title: 'Beta', difficulty: 'Easy', topics: ['Math'], timeLimitMs: 1000 });
    expect(stored[1].testCases).toHaveLength(3);
    expect(stored[1].codeTemplates.java.driver).toContain('public class Main');
  });

  it('updates an existing problem in place, keeping its _id and stats', async () => {
    const existing = await Problem.create({
      title: 'Old', slug: 'alpha', difficulty: 'Hard', description: 'old', stats: { submissions: 21, acceptance: 40 },
      codeTemplates: { python: { starter: 's', driver: 'd' } },
    });
    writePackage(root, 'alpha');

    await seedProblems({ execute: fakeExecute().execute, root, log: quiet });

    const stored = await Problem.findById(existing._id).lean();
    expect(stored).toMatchObject({ title: 'Double It', difficulty: 'Easy', stats: { submissions: 21, acceptance: 40 } });
    expect(Object.keys(stored.codeTemplates).sort()).toEqual(['cpp', 'java']);
    expect(await Problem.countDocuments()).toBe(1);
  });

  it('writes nothing when any package fails', async () => {
    writePackage(root, 'alpha');
    writePackage(root, 'beta', { tests: { tests: [{ args: [1], output: 3 }] } });

    await expect(seedProblems({ execute: fakeExecute().execute, root, log: quiet }))
      .rejects.toThrow('1 package(s) failed; nothing was written');
    expect(await Problem.countDocuments()).toBe(0);
  });

  it('lists every invalid package before building any', async () => {
    writePackage(root, 'alpha', { problem: { difficulty: 'Trivial' } });
    writePackage(root, 'beta', { problem: { topics: [] } });
    const fake = fakeExecute();

    await expect(seedProblems({ execute: fake.execute, root, log: quiet }))
      .rejects.toThrow(/Invalid packages:\nalpha:\n.*difficulty[\s\S]*beta:\n.*topics/);
    expect(fake.calls).toHaveLength(2); // only the self-test ran
  });

  it('checks without writing on a dry run, and can limit itself to some packages', async () => {
    writePackage(root, 'alpha');
    writePackage(root, 'beta');

    const result = await seedProblems({ execute: fakeExecute().execute, root, only: ['beta'], dryRun: true, log: quiet });

    expect(result).toEqual({ written: 0, checked: 1 });
    expect(await Problem.countDocuments()).toBe(0);
    await expect(seedProblems({ execute: fakeExecute().execute, root, only: ['gamma'], log: quiet }))
      .rejects.toThrow('No package named gamma');
  });

  it('stops before loading packages if the runtimes disagree', async () => {
    writePackage(root, 'alpha');
    const fake = fakeExecute({ tweak: (job, tests) => (job.prefix === 'java' && Object.values(job.files).includes('') ? [ok('0\n')] : tests) });

    await expect(seedProblems({ execute: fake.execute, root, log: quiet })).rejects.toThrow(/^Java runtime: int -2147483648 printed 0/);
    expect(fake.calls).toHaveLength(2);
  });
});
