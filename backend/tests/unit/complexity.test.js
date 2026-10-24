const {
  checkProfile, label, fit, summarize, measure, analyzeComplexity, timedRun, CLASSES, RUNS,
} = require('../../problemkit/complexity');
const { fakeExecute, ok } = require('../helpers/problemPackages');

const profile = (overrides = {}) => ({
  sizes: [1000, 2000, 4000, 8000, 16000], seeds: [1], expected: 'n', measure: 'n', variable: 'n', repeat: 1, ...overrides,
});
const F = Object.fromEntries(CLASSES.map((c) => [c.id, c.f]));
// Timings that follow a class, with a little deterministic noise
const pointsFor = (id, xs = [1000, 2000, 4000, 8000, 16000], scale = 1e-4) =>
  xs.map((x, i) => ({ n: x, x, ms: scale * F[id](x) * (1 + (i % 2 ? 0.03 : -0.03)) + 0.001, totalMs: 1 }));

describe('checkProfile', () => {
  it('accepts a profile and fills in the defaults', () => {
    const { profile: p, errors } = checkProfile({ sizes: [1, 2, 3, 4], seeds: [7], expected: 'n log n' }, { maxN: 10 });
    expect(errors).toEqual([]);
    expect(p).toEqual({ sizes: [1, 2, 3, 4], seeds: [7], expected: 'n log n', measure: 'n', variable: 'n', repeat: 1 });
  });

  it('reports every problem at once', () => {
    const { profile: p, errors } = checkProfile(
      { sizes: [4, 2, 8], seeds: [], expected: 'n!', measure: 'n^3', variable: 'm n', repeat: 0, colour: 1 },
      { maxN: 10, customDriver: true },
    );
    expect(p).toBeNull();
    expect(errors).toEqual([
      'complexity.json: unknown key "colour"',
      "complexity.json: can't be used with a hand-written driver",
      'complexity.json: sizes must be 4 to 8 increasing whole numbers >= 1',
      'complexity.json: seeds must list 1 or 2 whole numbers >= 0',
      expect.stringMatching(/^complexity.json: expected must be one of "1", "log n"/),
      'complexity.json: measure must be "n" or "n^2"',
      'complexity.json: variable must be 1 to 12 characters without spaces',
      'complexity.json: repeat must be a whole number from 1 to 100000',
    ]);
  });

  it('keeps sizes within the generated tests', () => {
    expect(checkProfile({ sizes: [1, 2, 3, 40], seeds: [1], expected: 'n' }, { maxN: 10 }).errors)
      .toEqual(['complexity.json: sizes must not exceed the largest generated test (n=10)']);
    expect(checkProfile({ sizes: [1, 2, 3, 4], seeds: [1], expected: 'n' }, { maxN: null }).errors)
      .toEqual(['complexity.json: the package needs generated tests']);
  });
});

describe('label', () => {
  it('writes big-O for a single-letter variable or a product', () => {
    expect(label('n log n')).toBe('O(n log n)');
    expect(label('1')).toBe('O(1)');
    expect(label('n', 'm·n')).toBe('O(m·n)');
    expect(label('n log n', 'm·n')).toBe('O(m·n log(m·n))');
    expect(label('n^2', 'm·n')).toBe('O((m·n)²)');
  });
});

describe('fit', () => {
  it.each(['log n', 'n', 'n log n', 'n^2', 'n^3'])('recognises %s', (id) => {
    expect(fit(pointsFor(id))[0].id).toBe(id);
  });

  it('recognises exponential growth on small inputs', () => {
    expect(fit(pointsFor('2^n', [10, 12, 14, 16, 18], 1e-3))[0].id).toBe('2^n');
  });

  it('recognises a constant', () => {
    expect(fit(pointsFor('1', undefined, 0.5))[0].id).toBe('1');
  });
});

describe('summarize', () => {
  it('reports a match with a curve to draw', () => {
    const r = summarize(pointsFor('n'), profile());
    expect(r).toMatchObject({ status: 'done', class: 'n', label: 'O(n)', verdict: 'matches', expectedLabel: 'O(n)' });
    expect(r.curves.best).toHaveLength(32);
    expect(r.curves.expected).toBeUndefined();
  });

  it('says when a solution grows faster or slower than expected, with both curves', () => {
    const slower = summarize(pointsFor('n^2'), profile());
    expect(slower).toMatchObject({ verdict: 'slower', label: 'O(n²)' });
    expect(slower.curves.expected).toHaveLength(32);
    expect(summarize(pointsFor('n'), profile({ expected: 'n^2' })).verdict).toBe('faster');
  });

  it('never calls neighbours that timings cannot separate faster or slower', () => {
    expect(summarize(pointsFor('n log n'), profile({ expected: 'n' }))).toMatchObject({ class: 'n log n', verdict: 'close' });
    expect(summarize(pointsFor('n'), profile({ expected: 'log n' })).verdict).toBe('slower');
  });

  it('reports flat timings as constant rather than a class with a tiny slope', () => {
    const flat = pointsFor('1', undefined, 0.5).map((p, i) => ({ ...p, ms: p.ms * (1 + 0.001 * i) }));
    expect(summarize(flat, profile({ expected: 'log n' }))).toMatchObject({ class: '1', verdict: 'close' });
  });

  it('calls it close when the expected class is a near runner-up', () => {
    // Halfway between n and n log n
    const points = pointsFor('n').map((p, i) => ({ ...p, ms: (p.ms + pointsFor('n log n', undefined, 1e-4 / 13)[i].ms) / 2 }));
    const r = summarize(points, profile({ expected: 'n log n' }));
    expect(['matches', 'close']).toContain(r.verdict);
  });

  it('is inconclusive with too few sizes, too little time or too much noise', () => {
    expect(summarize(pointsFor('n').slice(0, 3), profile())).toMatchObject({ status: 'inconclusive', reason: expect.stringMatching(/Too few/) });
    const fast = pointsFor('n').map((p) => ({ ...p, totalMs: 0.001 }));
    expect(summarize(fast, profile())).toMatchObject({ status: 'inconclusive', reason: expect.stringMatching(/too fast/) });
    const noisy = [5, 0.1, 9, 0.2, 7].map((ms, i) => ({ n: (i + 1) * 1000, x: (i + 1) * 1000, ms, totalMs: ms }));
    expect(summarize(noisy, profile())).toMatchObject({ status: 'inconclusive', reason: expect.stringMatching(/noisy/) });
  });
});

describe('timedRun', () => {
  const marker = 'cl-time-abc';
  it("reads the driver's last marker line, not lines the solution printed", () => {
    expect(timedRun(ok('1', { stderr: `debug\ncl-time-xyz 1 1\n${marker} 500 1\n${marker} 900 4\n` }), marker)).toEqual({ ns: 900, calls: 4 });
    expect(timedRun(ok('1', { stderr: 'cl-time-xyz 1 1\n' }), marker)).toBeNull();
  });
  it('ignores runs that failed', () => {
    expect(timedRun(ok('1', { exit: 1, stderr: `${marker} 5 1` }), marker)).toBeNull();
    expect(timedRun(ok('1', { tle: true, stderr: `${marker} 5 1` }), marker)).toBeNull();
  });
});

describe('measure', () => {
  const tools = {
    signature: { name: 'twice', params: [{ name: 'x', type: 'int' }], returns: 'int' },
    generator: 'void generate(long long n, Rng& rng) { emitInt(n); }',
  };

  it('generates each size once, then times every input RUNS times, interleaved', async () => {
    const fake = fakeExecute();
    const points = await measure({ ...tools, profile: profile({ sizes: [1, 2, 3, 4], seeds: [5, 6] }), timeLimitMs: 700, language: 'cpp', code: 'USER' }, { execute: fake.execute });

    const [gen, run] = fake.calls;
    expect(gen).toMatchObject({ prefix: 'cx-gen', inputs: ['1 5\n', '1 6\n', '2 5\n', '2 6\n', '3 5\n', '3 6\n', '4 5\n', '4 6\n'] });
    expect(run).toMatchObject({ prefix: 'cx-run', timeMs: 700, stopOnLimit: false });
    expect(run.run).toMatch(/^\.\/main cl-time-[0-9a-f]{16}$/);
    expect(run.files['Solution.cpp']).toBe('USER');
    expect(run.files['Main.cpp']).toContain('cl_best_ns');
    expect(run.inputs).toHaveLength(8 * RUNS);
    expect(run.inputs.slice(0, 2)).toEqual(['1005', '1006']);
    expect(run.inputs.slice(8, 10)).toEqual(['1005', '1006']);
    // The slower seed at each size: (n*1000+6)*100 ns
    expect(points).toEqual([1, 2, 3, 4].map((n) => ({ n, x: n, ms: ((n * 1000 + 6) * 100) / 1e6, totalMs: ((n * 1000 + 6) * 100) / 1e6 })));
  });

  it('keeps the fastest run per input and divides by the calls made', async () => {
    let k = 0;
    const fake = fakeExecute({
      tweak: (job, tests) => (job.prefix !== 'cx-run' ? tests : tests.map((t) => {
        const marker = job.run.split(' ').at(-1);
        return ok(t.stdout, { stderr: `${marker} ${[9000, 4000, 6000][k++ % 3]} 2\n` });
      })),
    });
    const points = await measure({ ...tools, profile: profile({ sizes: [7], seeds: [1] }), language: 'cpp', code: 'X' }, { execute: fake.execute });
    expect(points).toEqual([{ n: 7, x: 7, ms: 0.002, totalMs: 0.004 }]);
  });

  it('uses the Java timing driver and measures grids by cell count', async () => {
    const fake = fakeExecute();
    const points = await measure({ ...tools, profile: profile({ sizes: [3], measure: 'n^2' }), language: 'java', code: 'J' }, { execute: fake.execute });
    expect(fake.calls[1].run).toMatch(/ Main cl-time-/);
    expect(fake.calls[1].files['Main.java']).toContain('cl_best');
    expect(points[0].x).toBe(9);
  });

  it('leaves out sizes where no run finished', async () => {
    const fake = fakeExecute({
      tweak: (job, tests) => (job.prefix === 'cx-run' ? tests.map((t, i) => (i % 2 ? { ...t, tle: true } : t)) : tests),
    });
    const points = await measure({ ...tools, profile: profile({ sizes: [1, 2] }), language: 'cpp', code: 'X' }, { execute: fake.execute });
    // Inputs alternate 1, 2, 1, 2, ...: every run of size 2 timed out
    expect(points.map((p) => p.n)).toEqual([1]);
  });
});

describe('analyzeComplexity', () => {
  const problem = (complexity = profile()) => ({
    timeLimitMs: 500,
    analysisTools: {
      signature: { name: 'twice', params: [{ name: 'x', type: 'int' }], returns: 'int' },
      generator: 'SECRET GENERATOR', reference: 'SECRET REFERENCE', complexity,
    },
  });

  it('times the submission and fits it', async () => {
    const fake = fakeExecute();
    const r = await analyzeComplexity({ problem: problem(), language: 'cpp', code: 'X' }, { execute: fake.execute });
    expect(r).toMatchObject({ status: 'done', language: 'cpp', class: 'n', verdict: 'matches' });
    expect(JSON.stringify(r)).not.toContain('SECRET');
  });

  it('skips languages and problems it cannot time', async () => {
    const fake = fakeExecute();
    expect((await analyzeComplexity({ problem: problem(), language: 'python', code: 'X' }, { execute: fake.execute })).status).toBe('skipped');
    expect((await analyzeComplexity({ problem: problem(null), language: 'cpp', code: 'X' }, { execute: fake.execute })).status).toBe('skipped');
    expect(fake.execute).not.toHaveBeenCalled();
  });

  it('reports errors without passing on sandbox or compiler output', async () => {
    const noCompile = fakeExecute({ tweak: (job, tests) => tests });
    noCompile.execute.mockResolvedValueOnce({ compile: { ok: false, log: 'SECRET GENERATOR does not compile' }, tests: [] });
    expect(await analyzeComplexity({ problem: problem(), language: 'cpp', code: 'X' }, { execute: noCompile.execute }))
      .toEqual({ status: 'error', reason: 'The generator could not run.' });

    const crash = jest.fn().mockRejectedValue(new Error('SECRET REFERENCE docker failure'));
    expect(await analyzeComplexity({ problem: problem(), language: 'cpp', code: 'X' }, { execute: crash }))
      .toEqual({ status: 'error', reason: 'The analysis could not be completed.' });
  });
});
