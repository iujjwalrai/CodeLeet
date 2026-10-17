jest.mock('../../docker/runPython', () => jest.fn());
jest.mock('../../docker/runCpp', () => jest.fn());

const runPython = require('../../docker/runPython');
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

  it('publishes an error and leaves the submission alone for unsupported languages', async () => {
    const { job, submission } = await jobFor({ language: 'cobol' });

    const result = await processSubmission(job);

    expect(result).toMatchObject({ status: 'error' });
    expect(published().at(-1).data).toMatchObject({ status: 'error' });
    expect((await Submission.findById(submission._id)).status).toBe('in_queue');
  });
});
