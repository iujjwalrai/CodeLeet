jest.mock('../../docker/runCpp', () => {
  const actual = jest.requireActual('../../docker/runCpp');
  return Object.assign(jest.fn(), { cppJob: actual.cppJob });
});
jest.mock('../../problemkit/counterexample', () => ({
  ...jest.requireActual('../../problemkit/counterexample'), findCounterexample: jest.fn(),
}));
const runCpp = require('../../docker/runCpp');
const { findCounterexample } = require('../../problemkit/counterexample');
const { processRun } = require('../../worker/runWorker');
const { processSubmission } = require('../../worker/submissionWorker');
const cache = require('../../config/redis');
const pubsub = require('../../config/redispubsub');
const Submission = require('../../models/Submission');
const { useTestDb } = require('../helpers/db');
const { createUser, createProblem, createSubmission } = require('../helpers/factories');

useTestDb();
const counterexample = { status: 'found', input: '[1]', expected: '1', output: '0', failureStatus: 'wrong_answer', repetitions: 2 };
const tools = { signature: { params: [{ type: 'int[]' }] }, generator: 'SECRET GENERATOR', reference: 'SECRET REFERENCE', minN: 1, step: 1 };
const published = () => pubsub.publish.mock.calls.map(([, text]) => JSON.parse(text).data);

beforeEach(() => {
  runCpp.mockResolvedValue({ status: 'wrong_answer', failedTestCaseIndex: 0, failedTestCase: { input: '[1,2]', output: '2' }, output: '0' });
  findCounterexample.mockResolvedValue(counterexample);
  cache.get.mockResolvedValue(null);
});

async function jobFor() {
  const user = await createUser(), problem = await createProblem({ analysisTools: tools });
  const submission = await createSubmission(user, problem, { language: 'cpp' });
  return { submission, job: { id: '32', data: { submissionId: String(submission._id), problem: { codeTemplates: problem.codeTemplates, testCases: problem.testCases, analysisTools: tools }, language: 'cpp', code: 'USER' } } };
}

describe('verdict-first analysis', () => {
  it('publishes the Run verdict before ANALYSIS on the same channel', async () => {
    const { job } = await jobFor();
    const result = await processRun(job);
    expect(result.status).toBe('wrong_answer');
    expect(published()).toEqual([
      { status: 'Running' },
      expect.objectContaining({ status: 'wrong_answer', analysisPending: true }),
      expect.objectContaining({ type: 'ANALYSIS', status: 'found', input: '[1]' }),
    ]);
    expect(pubsub.publish.mock.calls.every(([channel]) => channel === 'job-updates:32')).toBe(true);
    expect(cache.set).toHaveBeenCalledWith('job-cache:job-updates:32:analysis', expect.any(String), 'EX', 60);
  });

  it('persists Submit analysis without replacing the verdict or resource measurements', async () => {
    const { job, submission } = await jobFor();
    await processSubmission(job);
    const stored = await Submission.findById(submission._id).lean();
    expect(stored.status).toBe('wrong_answer');
    expect(stored.analysis.counterexample).toEqual(counterexample);
    expect(published().map(d => d.type)).toEqual(['SUBMIT', 'SUBMIT', 'ANALYSIS']);
    expect(JSON.stringify(published())).not.toContain('SECRET');
  });

  it('sanitizes analysis errors and preserves the saved verdict', async () => {
    findCounterexample.mockRejectedValue(new Error('SECRET REFERENCE compiler log'));
    const { job, submission } = await jobFor();
    await processSubmission(job);
    expect((await Submission.findById(submission._id)).status).toBe('wrong_answer');
    expect(published().at(-1)).toMatchObject({ type: 'ANALYSIS', status: 'error' });
    expect(JSON.stringify(published())).not.toContain('SECRET');
  });

  it('keeps a complete replayable verdict when analysis finishes', async () => {
    cache.get.mockResolvedValue(JSON.stringify({ jobId: '32', data: { status: 'wrong_answer', analysisPending: true, output: '0' } }));
    const { job } = await jobFor();await processRun(job);
    const updates = cache.set.mock.calls.filter(([key]) => key === 'job-cache:job-updates:32');
    expect(JSON.parse(updates.at(-1)[1]).data).toMatchObject({ status: 'wrong_answer', output: '0', analysisPending: false, counterexample });
  });
});
