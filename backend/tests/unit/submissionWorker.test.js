jest.mock('../../docker/runPython', () => jest.fn());
jest.mock('../../docker/runCpp', () => jest.fn());

const runPython = require('../../docker/runPython');
const runCpp = require('../../docker/runCpp');
const analysisQueue = require('../../queue/analysisQueue');
const pubsub = require('../../config/redispubsub');
const cache = require('../../config/redis');
const Submission = require('../../models/Submission');
const { processSubmission } = require('../../worker/submissionWorker');
const { useTestDb } = require('../helpers/db');
const { createUser, createProblem, createSubmission } = require('../helpers/factories');

useTestDb();

const published = () =>
  pubsub.publish.mock.calls.map(([channel, payload]) => ({ channel, ...JSON.parse(payload) }));

const jobFor = async (overrides = {}) => {
  const user = await createUser();
  const problem = await createProblem();
  const submission = await createSubmission(user, problem);
  return {
    submission,
    job: {
      id: '21',
      data: {
        submissionId: submission._id.toString(),
        code: 'print(3)',
        language: 'python',
        problem: { codeTemplates: problem.codeTemplates, testCases: problem.testCases },
        ...overrides,
      },
    },
  };
};

describe('processSubmission', () => {
  it('saves an accepted verdict on the submission', async () => {
    runPython.mockResolvedValue({ status: 'accepted', output: 'All test cases passed', error: null, time: 42 });
    const { job, submission } = await jobFor();

    const result = await processSubmission(job);

    expect(result.status).toBe('accepted');
    const stored = await Submission.findById(submission._id);
    expect(stored).toMatchObject({ status: 'accepted', output: 'All test cases passed', time: 42 });
    expect(stored.failedTestCase).toBeUndefined();
  });

  it('saves and publishes what the judge measured', async () => {
    const resources = {
      testIndex: 1, peakKb: 3000, cpuMs: 12, wallMs: 14,
      timeline: [{ t: 0, rssKb: 900, cpuMs: 0 }, { t: 5, rssKb: 3000, cpuMs: 4 }],
      tests: [{ wallMs: 2, peakKb: 1200 }, { wallMs: 14, peakKb: 3000 }],
    };
    runPython.mockResolvedValue({ status: 'accepted', output: 'ok', time: 14, memory: 3000, resources });
    const { job, submission } = await jobFor();

    await processSubmission(job);

    const stored = await Submission.findById(submission._id).lean();
    expect(stored.analysis.resources).toEqual(resources);
    expect(published().at(-1).data.resources).toEqual(resources);
  });

  it('stores no resources when the runner measured none', async () => {
    runPython.mockResolvedValue({ status: 'accepted', output: 'ok', time: 1 });
    const { job, submission } = await jobFor();

    await processSubmission(job);

    expect((await Submission.findById(submission._id).lean()).analysis).toBeUndefined();
    expect(published().at(-1).data.resources).toBeNull();
  });

  it("passes the problem's time limit to the runner", async () => {
    runPython.mockResolvedValue({ status: 'accepted', output: 'ok', time: 1 });
    const { job } = await jobFor();
    job.data.problem.timeLimitMs = 500;

    await processSubmission(job);

    expect(runPython).toHaveBeenCalledWith(expect.objectContaining({ timeLimitMs: 500 }));
  });

  it('saves the failing test case on wrong answer', async () => {
    runPython.mockResolvedValue({
      status: 'wrong_answer',
      output: '11',
      error: 'Expected: 10, Got: 11',
      failedTestCase: { input: '5 5', output: '10' },
      failedTestCaseIndex: 1,
      time: 30,
    });
    const { job, submission } = await jobFor();

    await processSubmission(job);

    const stored = await Submission.findById(submission._id);
    expect(stored.status).toBe('wrong_answer');
    expect(stored.failedTestCase).toMatchObject({ input: '5 5', expected: '10', output: '11' });
  });

  it('publishes Running first, then the final verdict on the submission channel', async () => {
    runPython.mockResolvedValue({ status: 'accepted', output: 'ok', time: 1 });
    const { job } = await jobFor();

    await processSubmission(job);

    const updates = published();
    expect(updates.map((u) => u.channel)).toEqual(['job-updates-submission:21', 'job-updates-submission:21']);
    expect(updates[0].data).toEqual({ type: 'SUBMIT', status: 'Running' });
    expect(updates[1].data).toMatchObject({ type: 'SUBMIT', status: 'accepted' });
    expect(cache.set).toHaveBeenCalledWith('job-cache:job-updates-submission:21', expect.any(String), 'EX', 60);
  });

  it('stores the verdict before publishing it', async () => {
    runPython.mockResolvedValue({ status: 'accepted', output: 'ok', time: 1 });
    const { job } = await jobFor();
    const order = [];
    const updateOne = Submission.updateOne.bind(Submission);
    const saveSpy = jest.spyOn(Submission, 'updateOne').mockImplementation((...args) => {
      order.push('save');
      return updateOne(...args);
    });
    pubsub.publish.mockImplementation(async (_channel, payload) => {
      order.push(`publish:${JSON.parse(payload).data.status}`);
      return 1;
    });

    try {
      await processSubmission(job);
      // publishJobUpdate isn't awaited by the worker; let it flush.
      while (order.length < 3) await new Promise((resolve) => setImmediate(resolve));
    } finally {
      saveSpy.mockRestore();
    }

    expect(order).toEqual(['publish:Running', 'save', 'publish:accepted']);
  });

  describe('complexity analysis', () => {
    const tools = { signature: { params: [{ type: 'int' }] }, generator: 'g', reference: 'r', complexity: { sizes: [1, 2, 3, 4] } };
    const timedJob = async (status, language = 'cpp') => {
      (language === 'cpp' ? runCpp : runPython).mockResolvedValue({ status, output: 'ok', time: 1, failedTestCaseIndex: 0 });
      const { job, submission } = await jobFor({ language });
      job.data.problem.analysisTools = tools;
      return { job, submission };
    };

    it('queues Accepted C++ and Java submissions and says so in the verdict', async () => {
      const { job, submission } = await timedJob('accepted');

      await processSubmission(job);

      expect(analysisQueue.add).toHaveBeenCalledWith(
        'complexity', { submissionId: String(submission._id), jobId: '21' },
        expect.objectContaining({ jobId: `complexity-${submission._id}` }),
      );
      expect(published().at(-1).data).toMatchObject({ status: 'accepted', complexityPending: true });
      expect(cache.set).toHaveBeenLastCalledWith('job-cache:job-updates-submission:21', expect.any(String), 'EX', 180);
    });

    it('queues nothing for other verdicts, languages or problems without a profile', async () => {
      for (const [status, language] of [['wrong_answer', 'cpp'], ['accepted', 'python']]) {
        const { job } = await timedJob(status, language);
        await processSubmission(job);
      }
      runCpp.mockResolvedValue({ status: 'accepted', output: 'ok', time: 1 });
      const { job } = await jobFor({ language: 'cpp' });
      await processSubmission(job);

      expect(analysisQueue.add).not.toHaveBeenCalled();
      expect(published().filter((u) => u.data.status !== 'Running').every((u) => u.data.complexityPending === false)).toBe(true);
    });

    it('still publishes the verdict when the analysis queue is down', async () => {
      analysisQueue.add.mockRejectedValueOnce(new Error('redis down'));
      const { job } = await timedJob('accepted');

      const result = await processSubmission(job);

      expect(result.status).toBe('accepted');
      expect(published().at(-1).data).toMatchObject({ status: 'accepted', complexityPending: false });
    });
  });

  it('publishes an error and leaves the submission alone for unsupported languages', async () => {
    const { job, submission } = await jobFor({ language: 'cobol' });

    const result = await processSubmission(job);

    expect(result).toMatchObject({ status: 'error' });
    expect(published().at(-1).data).toMatchObject({ status: 'error' });
    expect((await Submission.findById(submission._id)).status).toBe('in_queue');
  });
});
