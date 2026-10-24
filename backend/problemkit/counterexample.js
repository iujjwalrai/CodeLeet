const { cppJob } = require('../docker/runCpp');
const { javaJob } = require('../docker/runJava');
const { execute: sandboxExecute } = require('../docker/judge');
const { generatorSource } = require('./codegen');
const { checkGeneratedLine } = require('./types');

const FAILURE_STATUSES = new Set(['wrong_answer', 'runtime_error', 'time_limit_exceeded', 'memory_limit_exceeded']);
const MAX_INPUT_BYTES = 4096;
const MAX_OUTPUT_BYTES = 4096;
const MAX_PROBES = 8;
// Two user runs per candidate. Compilations and reference/generator runs
// have their own sandbox limits; this caps the user execution budget.
const USER_RUNTIME_BUDGET_MS = 8000;
const gcd = (a, b) => b ? gcd(b, a % b) : a;
const bytes = (s) => Buffer.byteLength(s || '', 'utf8');

function buildAnalysisTools(pkg) {
  const generations = pkg.tests.flatMap((t, index) => t.gen ? [{ index, n: t.gen[0], seed: t.gen[1] }] : []);
  const sizes = [...new Set(generations.map(g => g.n))].sort((a, b) => a - b);
  // Stay above the smallest authored size, on the authored size lattice.
  // In particular, odd-only list/expression generators keep odd sizes.
  const minN = sizes[0] ?? 0;
  const step = sizes.reduce((d, n) => gcd(d, n - minN), 0) || 1;
  return { signature: pkg.signature, generator: pkg.generator, reference: pkg.reference.cpp, minN, step, generations };
}

function canAnalyze(problem, language, result) {
  const a = problem?.analysisTools;
  return ['cpp', 'java'].includes(language) && FAILURE_STATUSES.has(result?.status)
    && !!a?.generator && !!a?.reference && !!a?.signature?.params?.length
    && !!problem.codeTemplates?.cpp?.driver && !!problem.codeTemplates?.[language]?.driver
    && Number.isInteger(result.failedTestCaseIndex)
    && !!problem.testCases?.[result.failedTestCaseIndex]
    && Number.isSafeInteger(a.minN) && a.minN >= 0
    && Number.isSafeInteger(a.step) && a.step > 0;
}

function probeSizes(n, minN, step, count = MAX_PROBES) {
  const align = x => minN + Math.floor((x - minN) / step) * step;
  const sizes = new Set([minN, minN + step, n - step]);
  for (const part of [32, 16, 8, 4, 2]) sizes.add(align(n / part));
  const valid = [...sizes].filter(x => Number.isSafeInteger(x) && x >= minN && x < n && (x - minN) % step === 0).sort((a, b) => a - b);
  if (valid.length <= count) return valid;
  // Sample the whole range, not a binary search: failures need not be monotone.
  if (count === 1) return [valid[0]];
  return Array.from({ length: count }, (_, i) => valid[Math.round(i * (valid.length - 1) / (count - 1))]);
}

const successful = t => t && !t.tle && !t.mle && !t.signal && t.exit === 0 && !t.stdoutTruncated;
function failureKind(t, expected) {
  if (!t) return null;
  if (t.tle) return 'time_limit_exceeded';
  if (t.mle || /OutOfMemoryError/.test(t.stderr || '')) return 'memory_limit_exceeded';
  // An unclassified SIGKILL is ambiguous; do not advertise it as a reproducer.
  if (t.signal === 9) return null;
  if (t.signal || t.exit !== 0) return 'runtime_error';
  return (t.stdout || '').trim() !== expected ? 'wrong_answer' : 'accepted';
}

async function findCounterexample({ problem, language, code, result }, { execute = sandboxExecute } = {}) {
  if (!canAnalyze(problem, language, result)) return { status: 'skipped', reason: 'Analysis is not available for this verdict or problem.' };
  const tools = problem.analysisTools;
  const original = problem.testCases[result.failedTestCaseIndex];
  const origin = tools.generations?.find(g => g.index === result.failedTestCaseIndex);
  const limit = problem.timeLimitMs || 1000;
  const count = Math.min(MAX_PROBES, Math.floor(USER_RUNTIME_BUDGET_MS / (2 * limit)));
  if (count < 1) return { status: 'skipped', reason: 'The problem time limit exceeds the analysis budget.' };

  const candidates = [];
  const seen = new Set([original.input]);
  const add = c => {
    if (typeof c.input !== 'string' || bytes(c.input) > MAX_INPUT_BYTES || seen.has(c.input)) return;
    const smaller = origin && c.n !== undefined ? c.n < origin.n : bytes(c.input) < bytes(original.input);
    if (!smaller) return;
    const lines = c.input.trimEnd().split('\n');
    if (lines.length !== tools.signature.params.length || lines.some((line, i) => checkGeneratedLine(tools.signature.params[i].type, line))) return;
    seen.add(c.input); candidates.push(c);
  };

  // Known tests remain useful when the initial failure is hand-written or
  // its generated shape cannot reproduce the bug at a smaller size.
  const known = problem.testCases.filter(t => bytes(t.input) < bytes(original.input) && bytes(t.input) <= MAX_INPUT_BYTES)
    .sort((a, b) => bytes(a.input) - bytes(b.input));
  for (const t of known.slice(0, 2)) add({ input: t.input });
  const room = count - candidates.length;
  // Start near a genuinely small serialized input instead of generating
  // megabytes only to discard them. This is a heuristic, not a size proof.
  const ceiling = origin ? Math.min(origin.n, Math.max(tools.minN + tools.step,
    Math.floor(origin.n * MAX_INPUT_BYTES / Math.max(MAX_INPUT_BYTES, bytes(original.input))))) : 0;
  const probes = origin
    ? probeSizes(ceiling, tools.minN, tools.step, Math.max(0, room)).map(n => ({ n, seed: origin.seed }))
    : [...new Set((tools.generations || []).map(g => g.seed))].slice(0, Math.max(0, room)).map(seed => ({ n: tools.minN, seed }));
  if (room > 0 && probes.length) {
    const generated = await execute({
      image: cppJob({}).image, prefix: 'analysis-gen',
      files: { 'generator.cpp': generatorSource(tools.generator) },
      compile: 'cp /app/generator.cpp . && g++ -std=c++17 -O2 generator.cpp -o gen', run: './gen',
      timeMs: 500, stopOnLimit: false, inputs: probes.map(p => `${p.n} ${p.seed}\n`),
    });
    if (!generated?.compile?.ok) return { status: 'error', reason: 'The analysis generator could not run.' };
    probes.forEach((p, i) => { if (successful(generated.tests?.[i])) add({ ...p, input: generated.tests[i].stdout.trimEnd() }); });
  }
  // A regenerated input may be too large or duplicate a known case. Use
  // remaining slots for other small known inputs rather than wasting them.
  for (const t of known) {
    if (candidates.length >= count) break;
    add({ input: t.input });
  }
  candidates.sort((a, b) => bytes(a.input) - bytes(b.input) || (a.n || 0) - (b.n || 0));
  candidates.splice(count);
  if (!candidates.length) return { status: 'not_found', checked: 0, reason: 'No smaller candidates were available within the safe generator sizes.' };

  // Reference/generator source never enters the untrusted user container.
  const reference = await execute({
    ...cppJob({ userCode: tools.reference, driverCode: problem.codeTemplates.cpp.driver }),
    prefix: 'analysis-ref', timeMs: limit, stopOnLimit: false, inputs: candidates.map(c => c.input),
  });
  if (!reference?.compile?.ok) return { status: 'error', reason: 'The analysis reference could not run.' };
  const valid = candidates.flatMap((c, i) => {
    const r = reference.tests?.[i];
    if (!successful(r) || bytes(r.stdout) > MAX_OUTPUT_BYTES) return [];
    const expected = r.stdout.trim();
    if (checkGeneratedLine(tools.signature.returns, expected)) return [];
    return [{ ...c, expected }];
  });
  if (!valid.length) return { status: 'not_found', checked: 0, reason: 'No smaller candidate passed reference validation.' };
  const makeJob = language === 'cpp' ? cppJob : javaJob;
  const users = await execute({
    ...makeJob({ userCode: code, driverCode: problem.codeTemplates[language].driver }),
    prefix: 'analysis-user', timeMs: limit, stopOnLimit: false,
    inputs: valid.flatMap(c => [c.input, c.input]),
  });
  if (!users?.compile?.ok) return { status: 'error', reason: 'The analysis solution could not run.' };
  for (let i = 0; i < valid.length; i++) {
    const c = valid[i], first = users.tests?.[2 * i], second = users.tests?.[2 * i + 1];
    if (failureKind(first, c.expected) !== result.status || failureKind(second, c.expected) !== result.status) continue;
    const output = Buffer.from(first.stdout || '', 'utf8');
    return {
      status: 'found', failureStatus: result.status, input: c.input, expected: c.expected,
      output: output.subarray(0, MAX_OUTPUT_BYTES).toString('utf8'), outputTruncated: !!first.stdoutTruncated || output.length > MAX_OUTPUT_BYTES,
      originalBytes: bytes(original.input), bytes: bytes(c.input), n: c.n, seed: c.seed,
      checked: valid.length, repetitions: 2,
    };
  }
  return { status: 'not_found', checked: valid.length, reason: 'No smaller input reproduced the same failure twice within this bounded search.' };
}

module.exports = { buildAnalysisTools, canAnalyze, findCounterexample, probeSizes };
