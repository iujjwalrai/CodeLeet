const { buildAnalysisTools, canAnalyze, findCounterexample, probeSizes } = require('../../problemkit/counterexample');
const { ok } = require('../helpers/problemPackages');

const code = 'USER CODE';
const problemFor = () => ({
  timeLimitMs: 500,
  codeTemplates: { cpp: { driver: 'CPP DRIVER' }, java: { driver: 'JAVA DRIVER' } },
  testCases: [{ input: JSON.stringify(Array(100).fill(1)), output: '100', hidden: true }],
  analysisTools: {
    signature: { name: 'f', params: [{ name: 'a', type: 'int[]' }], returns: 'int' },
    generator: 'SECRET GENERATOR', reference: 'SECRET REFERENCE', minN: 1, step: 1,
    generations: [{ index: 0, n: 100, seed: 7 }],
  },
});
const verdict = { status: 'wrong_answer', failedTestCaseIndex: 0 };
function fake({ fail = () => true, tweak = (_job, tests) => tests } = {}) {
  return jest.fn(async job => {
    const tests = job.inputs.map(input => {
      if (job.prefix === 'analysis-gen') return ok(JSON.stringify(Array(Number(input.split(' ')[0])).fill(1)) + '\n');
      const n = JSON.parse(input).length;
      return ok(String(job.prefix === 'analysis-ref' || !fail(n) ? n : -1) + '\n');
    });
    return { compile: { ok: true }, tests: tweak(job, tests) };
  });
}

describe('counterexample search', () => {
  it('persists provenance and a conservative minimum/step from authored schedules', () => {
    const pkg = { signature: {}, generator: 'g', reference: { cpp: 'r' }, tests: [{ input: 'x' }, { gen: [1, 2] }, { gen: [5, 3] }, { gen: [9, 4] }] };
    expect(buildAnalysisTools(pkg)).toMatchObject({ minN: 1, step: 4, generations: [{ index: 1, n: 1, seed: 2 }, { index: 2, n: 5, seed: 3 }, { index: 3, n: 9, seed: 4 }] });
    expect(probeSizes(9, 1, 4)).toEqual([1, 5]);
    expect(probeSizes(9, 1, 4, 0)).toEqual([]);
  });

  it('finds a genuinely smaller input, runs the user twice, and isolates trusted source', async () => {
    const problem = problemFor(), execute = fake();
    const found = await findCounterexample({ problem, code, language: 'java', result: verdict }, { execute });
    expect(found).toMatchObject({ status: 'found', failureStatus: 'wrong_answer', input: '[1]', expected: '1', output: '-1\n', n: 1, seed: 7, repetitions: 2 });
    expect(found.bytes).toBeLessThan(found.originalBytes);
    expect(execute.mock.calls.map(([j]) => j.prefix)).toEqual(['analysis-gen', 'analysis-ref', 'analysis-user']);
    const userJob = execute.mock.calls[2][0];
    expect(userJob.files).toEqual({ 'Solution.java': code, 'Main.java': 'JAVA DRIVER' });
    expect(JSON.stringify(userJob)).not.toContain('SECRET');
    expect(userJob.inputs[0]).toBe(userJob.inputs[1]);
    expect(userJob.stopOnLimit).toBe(false);
  });

  it('does not assume that smaller sizes fail monotonically', async () => {
    const execute = fake({ fail: n => n === 2 });
    const found = await findCounterexample({ problem: problemFor(), code, language: 'cpp', result: verdict }, { execute });
    expect(found).toMatchObject({ status: 'found', n: 2 });
  });

  it('bounds generated sizes toward small inputs before allocating huge candidates', async () => {
    const problem = problemFor();problem.testCases[0].input = JSON.stringify(Array(10000).fill(1));
    problem.analysisTools.generations[0].n = 10000;
    const execute = fake();
    expect((await findCounterexample({ problem, code, language: 'cpp', result: verdict }, { execute })).status).toBe('found');
    const sizes = execute.mock.calls[0][0].inputs.map(x => Number(x.split(' ')[0]));
    expect(Math.max(...sizes)).toBeLessThan(2100);
  });

  it('rejects intermittent failures and failures of a different category', async () => {
    for (const tweak of [
      (j, ts) => j.prefix === 'analysis-user' ? ts.map((t, i) => i % 2 ? ok(String(JSON.parse(j.inputs[i]).length)) : t) : ts,
      (j, ts) => j.prefix === 'analysis-user' ? ts.map(t => ({ ...t, exit: 1 })) : ts,
    ]) {
      const found = await findCounterexample({ problem: problemFor(), code, language: 'cpp', result: verdict }, { execute: fake({ tweak }) });
      expect(found.status).toBe('not_found');
    }
  });

  it('skips malformed generator inputs and failed references', async () => {
    for (const tweak of [
      (j, ts) => j.prefix === 'analysis-gen' ? ts.map(() => ok('"invalid array"\n')) : ts,
      (j, ts) => j.prefix === 'analysis-ref' ? ts.map(t => ({ ...t, exit: 1 })) : ts,
    ]) {
      const found = await findCounterexample({ problem: problemFor(), code, language: 'cpp', result: verdict }, { execute: fake({ tweak }) });
      expect(found.status).toBe('not_found');
    }
  });

  it('can search smaller known cases when the failing case is hand-written', async () => {
    const problem = problemFor();problem.analysisTools.generations = [];
    problem.testCases.push({ input: '[1,1]', output: '2' });
    const found = await findCounterexample({ problem, code, language: 'cpp', result: verdict }, { execute: fake() });
    expect(found).toMatchObject({ status: 'found', input: '[1,1]', expected: '2' });
  });

  it('fills unused generated slots with more known cases when the first two pass', async () => {
    const problem = problemFor();problem.analysisTools.generations = [];
    problem.testCases.push({ input: '[1]', output: '1' }, { input: '[1,1]', output: '2' }, { input: '[1,1,1]', output: '3' });
    const found = await findCounterexample({ problem, code, language: 'cpp', result: verdict }, { execute: fake({ fail: n => n === 3 }) });
    expect(found).toMatchObject({ status: 'found', input: '[1,1,1]' });
  });

  it('recognizes a smaller scalar size even when its serialized byte length is unchanged', async () => {
    const problem = problemFor();problem.testCases[0].input = '99';
    problem.analysisTools = { ...problem.analysisTools, minN: 10, step: 1, generations: [{ index: 0, n: 99, seed: 0 }], signature: { params: [{ type: 'int' }], returns: 'int' } };
    const execute = jest.fn(async j => ({ compile: { ok: true }, tests: j.inputs.map(x => ok(j.prefix === 'analysis-gen' ? x.split(' ')[0] : j.prefix === 'analysis-ref' ? '1' : '0')) }));
    expect(await findCounterexample({ problem, code, language: 'cpp', result: verdict }, { execute })).toMatchObject({ status: 'found', input: '10' });
  });

  it('confirms TLEs twice under the original per-case time limit and budgets probes', async () => {
    const problem = problemFor();problem.timeLimitMs = 1200;
    const execute = fake({ tweak: (j, ts) => j.prefix === 'analysis-user' ? ts.map(t => ({ ...t, tle: true })) : ts });
    const found = await findCounterexample({ problem, code, language: 'cpp', result: { ...verdict, status: 'time_limit_exceeded' } }, { execute });
    expect(found).toMatchObject({ status: 'found', failureStatus: 'time_limit_exceeded', repetitions: 2 });
    const job = execute.mock.calls[2][0];
    expect(job.timeMs).toBe(1200);
    expect(job.inputs.length * job.timeMs).toBeLessThanOrEqual(8000);
  });

  it('does not launch sandboxes for accepted/compile failures, legacy problems, or unsupported languages', async () => {
    const execute = fake();
    for (const [problem, language, result] of [[problemFor(), 'cpp', { status: 'accepted' }], [problemFor(), 'cpp', { status: 'compilation_error' }], [{}, 'cpp', verdict], [problemFor(), 'python', verdict]]) {
      expect(canAnalyze(problem, language, result)).toBe(false);
      expect((await findCounterexample({ problem, code, language, result }, { execute })).status).toBe('skipped');
    }
    expect(execute).not.toHaveBeenCalled();
  });
});
