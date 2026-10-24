const crypto = require('crypto');
const { cppJob } = require('../docker/runCpp');
const { javaJob } = require('../docker/runJava');
const { execute: sandboxExecute } = require('../docker/judge');
const { generatorSource, cppTimedDriver, javaTimedDriver } = require('./codegen');
const { checkGeneratedLine } = require('./types');

/*
 * Estimates how a solution's running time grows. complexity.json in a
 * package says which generator sizes and seeds to time and which class the
 * intended solution has; the seed checks the reference against it, and the
 * analysis worker times Accepted submissions the same way (see README.md).
 *
 *   { "sizes": [6250, 12500, 25000, 50000, 100000], "seeds": [3],
 *     "expected": "n", "measure": "n", "variable": "n", "repeat": 1 }
 */

const PROFILE_KEYS = ['sizes', 'seeds', 'expected', 'measure', 'variable', 'repeat'];
const log2 = (x) => Math.log2(Math.max(x, 2));
const CLASSES = [
  { id: '1', f: () => 1 },
  { id: 'log n', f: (x) => log2(x) },
  { id: 'n', f: (x) => x },
  { id: 'n log n', f: (x) => x * log2(x) },
  { id: 'n^2', f: (x) => x * x },
  { id: 'n^3', f: (x) => x ** 3 },
  { id: '2^n', f: (x) => 2 ** x },
];
const RANK = Object.fromEntries(CLASSES.map((c, i) => [c.id, i]));
// The problem size N for a generator size n
const MEASURES = { n: (n) => n, 'n^2': (n) => n * n };

const RUNS = 3;              // timed runs per input; the fastest counts
const MIN_POINTS = 4;        // sizes that must finish for a fit
const MIN_MS = 0.01;         // the largest size's timed run must take at least this long
const MAX_ERROR = 0.35;      // relative error above which timings are noise
const CLOSE = 1.25;          // runner-up within this factor of the best: too close to call
// Neighbours that timings can't reliably tell apart at these sizes: cache
// misses make linear hashing or list walking look like n log n, and a few
// steps of log n look constant. Never reported as faster or slower.
const NEIGHBOURS = [['1', 'log n'], ['n', 'n log n']];
const neighbours = (a, b) => NEIGHBOURS.some((pair) => pair.includes(a) && pair.includes(b));
const CURVE_POINTS = 32;

class ComplexityError extends Error {}

/* Checks complexity.json. Returns { profile, errors }. maxN is the largest generated test size. */
function checkProfile(raw, { maxN, customDriver }) {
  const errors = [];
  const where = 'complexity.json:';
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { profile: null, errors: [`${where} must be an object`] };
  for (const key of Object.keys(raw)) if (!PROFILE_KEYS.includes(key)) errors.push(`${where} unknown key "${key}"`);
  if (customDriver) errors.push(`${where} can't be used with a hand-written driver`);
  if (maxN == null) errors.push(`${where} the package needs generated tests`);

  const { sizes, seeds, expected, measure = 'n', variable = 'n', repeat = 1 } = raw;
  const sizesOk = Array.isArray(sizes) && sizes.length >= MIN_POINTS && sizes.length <= 8
    && sizes.every((n, i) => Number.isSafeInteger(n) && n >= 1 && (i === 0 || n > sizes[i - 1]));
  if (!sizesOk) errors.push(`${where} sizes must be ${MIN_POINTS} to 8 increasing whole numbers >= 1`);
  else if (maxN != null && sizes.at(-1) > maxN) errors.push(`${where} sizes must not exceed the largest generated test (n=${maxN})`);
  if (!Array.isArray(seeds) || seeds.length < 1 || seeds.length > 2 || !seeds.every((s) => Number.isSafeInteger(s) && s >= 0)) {
    errors.push(`${where} seeds must list 1 or 2 whole numbers >= 0`);
  }
  if (!(expected in RANK)) errors.push(`${where} expected must be one of ${CLASSES.map((c) => `"${c.id}"`).join(', ')}`);
  if (!(measure in MEASURES)) errors.push(`${where} measure must be "n" or "n^2"`);
  if (typeof variable !== 'string' || !/^[\x21-\x7e·]{1,12}$/.test(variable)) errors.push(`${where} variable must be 1 to 12 characters without spaces`);
  if (!Number.isInteger(repeat) || repeat < 1 || repeat > 100000) errors.push(`${where} repeat must be a whole number from 1 to 100000`);

  return { profile: errors.length ? null : { sizes, seeds, expected, measure, variable, repeat }, errors };
}

/* "O(n log n)", or "O((m·n)²)" when the variable is more than a letter */
function label(id, variable = 'n') {
  const v = variable, g = /^[A-Za-z]$/.test(v) ? v : `(${v})`;
  const log = g === v ? `log ${v}` : `log${g}`;
  return {
    1: 'O(1)', 'log n': `O(${log})`, n: `O(${v})`, 'n log n': `O(${v} ${log})`,
    'n^2': `O(${g}²)`, 'n^3': `O(${g}³)`, '2^n': `O(2^${g})`,
  }[id];
}

/*
 * Fits ms = a·f(x) + b (a, b >= 0) for each class, minimising relative
 * error so small and large sizes count alike. Best fit first.
 */
function fit(points) {
  const ranking = [];
  for (const c of CLASSES) {
    const fs = points.map((p) => c.f(p.x));
    if (!fs.every((v) => Number.isFinite(v) && v > 0)) continue;
    // Scaled so the normal equations stay well conditioned
    const scale = Math.max(...fs);
    const u = fs.map((v, i) => v / scale / points[i].ms);
    const w = points.map((p) => 1 / p.ms);
    const dot = (x, y) => x.reduce((s, xi, i) => s + xi * y[i], 0);
    const sum = (x) => x.reduce((s, xi) => s + xi, 0);
    const error = (a, b) => Math.sqrt(points.reduce((s, p, i) => s + ((a * fs[i] / scale + b - p.ms) / p.ms) ** 2, 0) / points.length);

    const options = [
      [sum(u) / dot(u, u), 0],   // a·f(x)
      [0, sum(w) / dot(w, w)],   // b alone, a constant
    ];
    const det = dot(u, u) * dot(w, w) - dot(u, w) ** 2;
    if (c.id !== '1' && Math.abs(det) > 1e-12 * dot(u, u) * dot(w, w)) {
      const a = (sum(u) * dot(w, w) - sum(w) * dot(u, w)) / det;
      const b = (dot(u, u) * sum(w) - dot(u, w) * sum(u)) / det;
      if (a >= 0 && b >= 0) options.push([a, b]);
    }
    const usable = c.id === '1' ? [options[1]] : options.filter(([a]) => a > 0);
    if (!usable.length) continue;
    const [a, b] = usable.reduce((best, o) => (error(...o) < error(...best) ? o : best));
    ranking.push({ id: c.id, a: a / scale, b, error: error(a, b) });
  }
  return ranking.sort((p, q) => p.error - q.error);
}

// Four significant digits: a repeated call can take well under a microsecond
const round = (v) => Number(v.toPrecision(4));

function curve(points, entry) {
  const f = CLASSES[RANK[entry.id]].f;
  const lo = points[0].x, hi = points.at(-1).x;
  return Array.from({ length: CURVE_POINTS }, (_, i) => {
    const x = lo + ((hi - lo) * i) / (CURVE_POINTS - 1);
    return [round(x), round(entry.a * f(x) + entry.b)];
  });
}

/* Turns timed points into the result shown to the user */
function summarize(points, profile) {
  const { expected, variable } = profile;
  const base = { expected, expectedLabel: label(expected, variable), variable, points };
  if (points.length < MIN_POINTS) return { status: 'inconclusive', reason: 'Too few sizes finished to estimate a trend.', ...base };
  // Repeated calls are timed together, so the total is what must be measurable
  if (points.at(-1).totalMs < MIN_MS) return { status: 'inconclusive', reason: 'Your solution runs too fast at these sizes to measure a trend.', ...base };
  const ranking = fit(points);
  if (!ranking.length || ranking[0].error > MAX_ERROR) return { status: 'inconclusive', reason: 'The timings were too noisy to fit a curve.', ...base };

  // With the constant term, a faster-growing class can fit flat timings
  // almost as well as a slower one, so of the classes that fit about as
  // well as the best, report the slowest-growing
  const tied = ranking.filter((r) => r.error <= ranking[0].error * CLOSE);
  const best = tied.reduce((a, b) => (RANK[b.id] < RANK[a.id] ? b : a));
  const close = tied.find((r) => r !== best) || null;
  let verdict;
  if (best.id === expected) verdict = 'matches';
  else if (close?.id === expected || neighbours(best.id, expected)) verdict = 'close';
  else verdict = RANK[best.id] > RANK[expected] ? 'slower' : 'faster';
  const fitted = ranking.find((r) => r.id === expected);
  return {
    status: 'done', ...base,
    class: best.id, label: label(best.id, variable), verdict,
    ...(close ? { closeTo: close.id, closeToLabel: label(close.id, variable) } : {}),
    curves: { best: curve(points, best), ...(fitted && best.id !== expected ? { expected: curve(points, fitted) } : {}) },
    ranking: ranking.slice(0, 3).map((r) => ({ id: r.id, error: round(r.error) })),
  };
}

const successful = (t) => t && !t.tle && !t.mle && !t.signal && t.exit === 0 && !t.stdoutTruncated;

/* The last "<marker> <ns> <calls>" line the timing driver printed: { ns, calls } */
function timedRun(t, marker) {
  if (!successful(t)) return null;
  const lines = (t.stderr || '').split('\n').filter((l) => l.startsWith(`${marker} `));
  const [ns, calls] = (lines.at(-1)?.slice(marker.length + 1) || '').split(' ').map(Number);
  return Number.isFinite(ns) && ns >= 0 && Number.isSafeInteger(calls) && calls >= 1 ? { ns, calls } : null;
}

/*
 * Times `code` at every size in the profile. Returns [{ n, x, ms }] for the
 * sizes that ran: per input the fastest of RUNS runs, per size the slowest
 * of its seeds. Throws ComplexityError when the analysis can't run at all.
 */
async function measure({ profile, signature, generator, timeLimitMs, language, code }, { execute }) {
  const shapes = profile.sizes.flatMap((n) => profile.seeds.map((seed) => ({ n, seed })));
  const gen = await execute({
    image: cppJob({}).image, prefix: 'cx-gen',
    files: { 'generator.cpp': generatorSource(generator) },
    compile: 'cp /app/generator.cpp . && g++ -std=c++17 -O2 generator.cpp -o gen', run: './gen',
    timeMs: 2000, stopOnLimit: false, inputs: shapes.map((s) => `${s.n} ${s.seed}\n`),
  });
  if (!gen?.compile?.ok) throw new ComplexityError('The generator could not run.');
  shapes.forEach((s, i) => {
    const t = gen.tests?.[i];
    const lines = successful(t) ? t.stdout.trimEnd().split('\n') : [];
    if (lines.length !== signature.params.length || lines.some((l, j) => checkGeneratedLine(signature.params[j].type, l))) {
      throw new ComplexityError(`The generator failed for n=${s.n} seed=${s.seed}.`);
    }
    s.input = lines.join('\n');
  });

  const marker = `cl-time-${crypto.randomBytes(8).toString('hex')}`;
  const job = language === 'cpp'
    ? cppJob({ userCode: code, driverCode: cppTimedDriver(signature, profile.repeat) })
    : javaJob({ userCode: code, driverCode: javaTimedDriver(signature, profile.repeat) });
  // Each round runs every input once, so a slow moment doesn't hit all runs of one size
  const order = Array.from({ length: RUNS }, () => shapes).flat();
  const report = await execute({
    ...job, prefix: 'cx-run', run: `${job.run} ${marker}`,
    timeMs: timeLimitMs || 1000, stopOnLimit: false, inputs: order.map((s) => s.input),
  });
  if (!report) throw new ComplexityError('The solution stopped the judge.');
  if (!report.compile?.ok) throw new ComplexityError('The solution did not compile.');

  // Per input, the run with the fastest time per call
  const fastest = new Map();
  order.forEach((s, i) => {
    const run = timedRun(report.tests?.[i], marker);
    if (run && !(fastest.get(s)?.ns / fastest.get(s)?.calls <= run.ns / run.calls)) fastest.set(s, run);
  });
  return profile.sizes.flatMap((n) => {
    const runs = profile.seeds.map((seed) => fastest.get(shapes.find((s) => s.n === n && s.seed === seed)));
    if (runs.some((r) => r === undefined)) return [];
    const slowest = runs.reduce((a, b) => (b.ns / b.calls > a.ns / a.calls ? b : a));
    return [{ n, x: MEASURES[profile.measure](n), ms: round(slowest.ns / slowest.calls / 1e6), totalMs: round(slowest.ns / 1e6) }];
  });
}

function canMeasure(problem, language, result) {
  const a = problem?.analysisTools;
  return ['cpp', 'java'].includes(language) && result?.status === 'accepted'
    && !!a?.complexity?.sizes?.length && !!a.generator && !!a.signature?.params?.length;
}

/* The analysis worker's entry point. Never throws; errors carry no trusted source. */
async function analyzeComplexity({ problem, language, code }, { execute = sandboxExecute } = {}) {
  if (!canMeasure(problem, language, { status: 'accepted' })) {
    return { status: 'skipped', reason: 'Complexity analysis is not available for this problem or language.' };
  }
  const tools = problem.analysisTools;
  try {
    const points = await measure({
      profile: tools.complexity, signature: tools.signature, generator: tools.generator,
      timeLimitMs: problem.timeLimitMs, language, code,
    }, { execute });
    return { language, ...summarize(points, tools.complexity) };
  } catch (err) {
    return { status: 'error', reason: err instanceof ComplexityError ? err.message : 'The analysis could not be completed.' };
  }
}

module.exports = {
  checkProfile, label, fit, summarize, measure, canMeasure, analyzeComplexity, timedRun,
  CLASSES, MEASURES, RUNS, ComplexityError,
};
