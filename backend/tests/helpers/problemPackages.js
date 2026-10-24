const fs = require('fs');
const os = require('os');
const path = require('path');
const { SAMPLES } = require('../../problemkit/selftest');

// A small valid package: double(x) = 2x
const baseProblem = () => ({
  title: 'Double It',
  difficulty: 'Easy',
  topics: ['Math'],
  description: 'Return twice x.',
  constraints: ['-1000 <= x <= 1000'],
  function: { name: 'twice', params: [{ name: 'x', type: 'int' }], returns: 'int' },
  examples: [{ args: [2], output: 4, explanation: '2 * 2 = 4.' }],
});

const baseTests = () => ({ tests: [{ args: [-3], output: -6 }, { gen: [10, 1] }] });

// Writes a package folder under root. `files` replaces or adds files
// (null removes one); problem/tests are merged into the valid defaults.
function writePackage(root, slug, { problem = {}, tests, files = {} } = {}) {
  const dir = path.join(root, slug);
  fs.mkdirSync(dir, { recursive: true });
  const all = {
    'problem.json': JSON.stringify({ ...baseProblem(), ...problem }),
    'tests.json': JSON.stringify(tests ?? baseTests()),
    'reference.cpp': 'class Solution { public: int twice(int x) { return 2 * x; } };',
    'generator.cpp': 'void generate(long long n, Rng& rng) { emitInt(rng.range(-n, n)); }',
    ...files,
  };
  for (const [name, content] of Object.entries(all)) {
    if (content === null) continue;
    fs.mkdirSync(path.dirname(path.join(dir, name)), { recursive: true });
    fs.writeFileSync(path.join(dir, name), content);
  }
  return dir;
}

const tempRoot = () => fs.mkdtempSync(path.join(os.tmpdir(), 'codeleet-packages-'));

const ok = (stdout, extra = {}) => ({
  exit: 0, signal: 0, tle: false, mle: false, wallMs: 5, cpuMs: 4, peakKb: 1000,
  stdout, stdoutTruncated: false, stderr: '', timeline: [], ...extra,
});

/*
 * Fake docker/judge.js execute. Generator jobs print "n*1000+seed" as the
 * input; reference jobs answer `solve(input)` (twice x by default); timed
 * complexity runs report `timeNs(input)` after the job's marker (linear in
 * n by default); the runtime self-test echo jobs print the expected
 * samples. `tweak(job, tests)` can change the report before it is returned.
 */
function fakeExecute({
  solve = (input) => String(2 * Number(input)),
  timeNs = (input) => 100 * Number(input),
  tweak = (_job, tests) => tests,
} = {}) {
  const calls = [];
  const execute = jest.fn(async (job) => {
    calls.push(job);
    let tests;
    if (job.prefix === 'gen' || job.prefix === 'cx-gen') {
      tests = job.inputs.map((input) => {
        const [n, seed] = input.trim().split(' ').map(Number);
        return ok(`${n * 1000 + seed}\n`);
      });
    } else if (job.prefix === 'cx-run') {
      const marker = job.run.split(' ').at(-1);
      tests = job.inputs.map((input) => ok(`${solve(input)}\n`, { stderr: `\n${marker} ${timeNs(input)} 1\n` }));
    } else if (Object.values(job.files).includes('')) {
      const echoed = SAMPLES.map(([, text, out = text]) => out).join('\n');
      tests = [ok(`${echoed}\n`)];
    } else {
      tests = job.inputs.map((input) => ok(`${solve(input)}\n`));
    }
    return { version: 1, compile: { ran: true, ok: true, log: '' }, tests: tweak(job, tests) };
  });
  return { execute, calls };
}

module.exports = { writePackage, tempRoot, fakeExecute, ok };
