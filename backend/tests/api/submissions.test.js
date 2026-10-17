const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../../app');
const queue = require('../../queue/submissionQueue');
const runQueue = require('../../queue/runQueue');
const Submission = require('../../models/Submission');
const User = require('../../models/User');
const Problem = require('../../models/Problem');
const { useTestDb } = require('../helpers/db');
const { createUser, createProblem, createSubmission, authFor } = require('../helpers/factories');

useTestDb();

describe('POST /api/submissions', () => {
  it('stores an in_queue submission, bumps stats and enqueues the job', async () => {
    const user = await createUser();
    const problem = await createProblem();

    const res = await request(app)
      .post('/api/submissions')
      .set('Authorization', authFor(user).bearer)
      .send({ problemId: problem._id.toString(), language: 'python', code: 'print(3)' });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ success: true, jobId: expect.any(String) });

    const submission = await Submission.findOne({ user: user._id });
    expect(submission).toMatchObject({ status: 'in_queue', language: 'python', code: 'print(3)' });

    expect((await User.findById(user._id)).stats.totalSubmissions).toBe(1);
    expect((await Problem.findById(problem._id)).stats.submissions).toBe(1);

    expect(queue.add).toHaveBeenCalledTimes(1);
    const [jobName, jobData] = queue.add.mock.calls[0];
    expect(jobName).toBe('run-submission');
    expect(jobData.submissionId.toString()).toBe(submission._id.toString());
    expect(jobData.problem.testCases).toHaveLength(2);
    expect(jobData.problem.codeTemplates.python.driver).toBe('solve()');
  });

  it('returns 400 when fields are missing', async () => {
    const user = await createUser();

    const res = await request(app)
      .post('/api/submissions')
      .set('Authorization', authFor(user).bearer)
      .send({ language: 'python' });

    expect(res.status).toBe(400);
    expect(queue.add).not.toHaveBeenCalled();
  });

  it('requires authentication', async () => {
    const res = await request(app).post('/api/submissions').send({});
    expect(res.status).toBe(401);
  });

  it('returns 404 for an unknown problem', async () => {
    const user = await createUser();

    const res = await request(app)
      .post('/api/submissions')
      .set('Authorization', authFor(user).bearer)
      .send({ problemId: new mongoose.Types.ObjectId().toString(), language: 'python', code: 'x' });

    expect(res.status).toBe(404);
  });
});

describe('POST /api/submissions/run', () => {
  it('enqueues a run job with custom input and returns 202', async () => {
    const user = await createUser();
    const problem = await createProblem();

    const res = await request(app)
      .post('/api/submissions/run')
      .set('Authorization', authFor(user).bearer)
      .send({ problemId: problem._id.toString(), language: 'cpp', code: 'int x;', customInput: '4 4' });

    expect(res.status).toBe(202);
    expect(res.body.jobId).toEqual(expect.any(String));
    expect(runQueue.add).toHaveBeenCalledWith(
      'run-code',
      expect.objectContaining({ code: 'int x;', language: 'cpp', input: '4 4' }),
      { removeOnComplete: true, removeOnFail: true },
    );
    expect(await Submission.countDocuments()).toBe(0);
  });

  it('returns 400 when fields are missing', async () => {
    const user = await createUser();

    const res = await request(app).post('/api/submissions/run').set('Authorization', authFor(user).bearer).send({});

    expect(res.status).toBe(400);
  });

  it('returns 404 for an unknown problem', async () => {
    const user = await createUser();

    const res = await request(app)
      .post('/api/submissions/run')
      .set('Authorization', authFor(user).bearer)
      .send({ problemId: new mongoose.Types.ObjectId().toString(), language: 'python', code: 'x' });

    expect(res.status).toBe(404);
  });
});

describe('GET /api/submissions/me', () => {
  it("returns only the caller's submissions, newest first, limited", async () => {
    const user = await createUser();
    const other = await createUser();
    const problem = await createProblem({ title: 'Two Sum' });

    for (let i = 0; i < 12; i++) {
      await createSubmission(user, problem, { createdAt: new Date(2026, 0, i + 1) });
    }
    await createSubmission(other, problem);

    const res = await request(app).get('/api/submissions/me').set('Authorization', authFor(user).bearer);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(10);
    expect(res.body.every((s) => s.user === user._id.toString())).toBe(true);
    expect(res.body[0].problem.title).toBe('Two Sum');
    expect(new Date(res.body[0].createdAt).getDate()).toBe(12);
  });

  it('filters by problemId and honours limit', async () => {
    const user = await createUser();
    const a = await createProblem();
    const b = await createProblem();
    await createSubmission(user, a);
    await createSubmission(user, a);
    await createSubmission(user, b);

    const res = await request(app)
      .get(`/api/submissions/me?problemId=${a._id}&limit=1`)
      .set('Authorization', authFor(user).bearer);

    expect(res.body).toHaveLength(1);
    expect(res.body[0].problem._id).toBe(a._id.toString());
  });
});
