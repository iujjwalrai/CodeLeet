jest.mock('../../problemkit/complexity', () => ({
  ...jest.requireActual('../../problemkit/complexity'), analyzeComplexity: jest.fn(),
}));
const { analyzeComplexity } = require('../../problemkit/complexity');
const { processAnalysis } = require('../../worker/analysisWorker');
const cache = require('../../config/redis');
const pubsub = require('../../config/redispubsub');
const Submission = require('../../models/Submission');
const { useTestDb } = require('../helpers/db');
const { createUser, createProblem, createSubmission } = require('../helpers/factories');

useTestDb();

const complexity = { status: 'done', language: 'cpp', class: 'n', label: 'O(n)', verdict: 'matches' };
const tools = { signature: { params: [{ type: 'int' }] }, generator: 'SECRET GENERATOR', reference: 'SECRET REFERENCE', complexity: { sizes: [1, 2, 3, 4] } };
const published = () => pubsub.publish.mock.calls.map(([channel, text]) => ({ channel, ...JSON.parse(text) }));

async function jobFor(status = 'accepted') {
  const user = await createUser(), problem = await createProblem({ analysisTools: tools, timeLimitMs: 700 });
  const submission = await createSubmission(user, problem, { language: 'cpp', code: 'USER CODE', status });
  return { submission, job: { data: { submissionId: String(submission._id), jobId: '41' } } };
}

beforeEach(() => {
  analyzeComplexity.mockResolvedValue(complexity);
  cache.get.mockResolvedValue(null);
});

describe('processAnalysis', () => {
  it('times the stored submission against its problem and saves the result', async () => {
    const { job, submission } = await jobFor();

    expect(await processAnalysis(job)).toEqual({ status: 'done' });

    const [{ problem, language, code }] = analyzeComplexity.mock.calls[0];
    expect({ language, code, timeLimitMs: problem.timeLimitMs }).toEqual({ language: 'cpp', code: 'USER CODE', timeLimitMs: 700 });
    expect(problem.analysisTools.complexity).toEqual(tools.complexity);
    const stored = await Submission.findById(submission._id).lean();
    expect(stored).toMatchObject({ status: 'accepted', analysis: { complexity } });
  });

  it('publishes COMPLEXITY on the submission channel and caches it for late subscribers', async () => {
    cache.get.mockResolvedValue(JSON.stringify({ jobId: '41', data: { type: 'SUBMIT', status: 'accepted', complexityPending: true } }));
    const { job } = await jobFor();

    await processAnalysis(job);

    expect(published()).toEqual([{ channel: 'job-updates-submission:41', jobId: '41', data: { type: 'COMPLEXITY', ...complexity } }]);
    expect(cache.set).toHaveBeenCalledWith('job-cache:job-updates-submission:41:complexity', expect.any(String), 'EX', 60);
    const verdict = cache.set.mock.calls.find(([key]) => key === 'job-cache:job-updates-submission:41');
    expect(JSON.parse(verdict[1]).data).toMatchObject({ status: 'accepted', complexityPending: false, complexity });
    expect(JSON.stringify(published())).not.toContain('SECRET');
  });

  it('skips submissions that are not Accepted', async () => {
    const { job, submission } = await jobFor('wrong_answer');

    expect(await processAnalysis(job)).toEqual({ status: 'skipped' });
    expect(analyzeComplexity).not.toHaveBeenCalled();
    expect((await Submission.findById(submission._id).lean()).analysis.complexity.status).toBe('skipped');
    expect(published()[0].data).toMatchObject({ type: 'COMPLEXITY', status: 'skipped' });
  });
});
