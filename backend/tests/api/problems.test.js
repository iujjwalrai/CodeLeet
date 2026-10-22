const request = require('supertest');
const app = require('../../app');
const Problem = require('../../models/Problem');
const { useTestDb } = require('../helpers/db');
const { createUser, createProblem, authFor } = require('../helpers/factories');

useTestDb();

describe('GET /api/problems', () => {
  beforeEach(async () => {
    await createProblem({ title: 'Two Sum', slug: 'two-sum', difficulty: 'Easy', topics: ['arrays', 'hashing'] });
    await createProblem({
      title: 'LRU Cache',
      slug: 'lru-cache',
      difficulty: 'Medium',
      topics: ['design'],
      description: 'Design a least recently used cache',
      stats: { acceptance: 40 },
    });
    await createProblem({ title: 'Median of Arrays', slug: 'median', difficulty: 'Hard', topics: ['arrays'], stats: { acceptance: 90 } });
  });

  it('lists problems sorted by title with pagination meta', async () => {
    const res = await request(app).get('/api/problems');

    expect(res.status).toBe(200);
    expect(res.body.data.map((p) => p.title)).toEqual(['LRU Cache', 'Median of Arrays', 'Two Sum']);
    expect(res.body.meta).toEqual({ total: 3, page: 1, pages: 1 });
  });

  it('paginates with page and limit', async () => {
    const res = await request(app).get('/api/problems?page=2&limit=2');

    expect(res.body.data.map((p) => p.title)).toEqual(['Two Sum']);
    expect(res.body.meta).toEqual({ total: 3, page: 2, pages: 2 });
  });

  it('filters by difficulty', async () => {
    const res = await request(app).get('/api/problems?difficulty=Hard');
    expect(res.body.data.map((p) => p.slug)).toEqual(['median']);
  });

  it('filters by topic', async () => {
    const res = await request(app).get('/api/problems?topic=arrays');
    expect(res.body.data.map((p) => p.slug).sort()).toEqual(['median', 'two-sum']);
  });

  it('searches title and description case-insensitively', async () => {
    const byTitle = await request(app).get('/api/problems?search=two');
    const byDescription = await request(app).get('/api/problems?search=RECENTLY');

    expect(byTitle.body.data.map((p) => p.slug)).toEqual(['two-sum']);
    expect(byDescription.body.data.map((p) => p.slug)).toEqual(['lru-cache']);
  });

  it('sorts by acceptance (highest first)', async () => {
    const res = await request(app).get('/api/problems?sortBy=acceptance');
    expect(res.body.data[0].slug).toBe('median');
  });

  it('falls back to title sort for unknown sortBy values', async () => {
    const res = await request(app).get('/api/problems?sortBy=nonsense');
    expect(res.body.data[0].title).toBe('LRU Cache');
  });
});

describe('GET /api/problems/:slug', () => {
  it('returns the problem', async () => {
    await createProblem({ slug: 'two-sum', title: 'Two Sum' });

    const res = await request(app).get('/api/problems/two-sum');

    expect(res.status).toBe(200);
    expect(res.body.title).toBe('Two Sum');
  });

  it('returns 404 for an unknown slug', async () => {
    const res = await request(app).get('/api/problems/nope');
    expect(res.status).toBe(404);
  });
});

describe('private problem fields', () => {
  // Test cases (hidden ones included) and driver code are for judging only
  const expectNoPrivateFields = (problem) => {
    expect(problem.testCases).toBeUndefined();
    expect(problem.codeTemplates.python).toEqual({ starter: 'def solve(): pass' });
    expect(problem.codeTemplates.cpp).toEqual({ starter: 'int solve();' });
  };

  it('leaves test cases and drivers out of the problem page', async () => {
    await createProblem({ slug: 'two-sum' });

    const res = await request(app).get('/api/problems/two-sum');

    expectNoPrivateFields(res.body);
  });

  it('leaves test cases and drivers out of the problem list', async () => {
    await createProblem();

    const res = await request(app).get('/api/problems');

    expectNoPrivateFields(res.body.data[0]);
  });

  it('still loads them for judging', async () => {
    const created = await createProblem();

    const problem = await Problem.findById(created._id).select(Problem.JUDGING_FIELDS);

    expect(problem.testCases).toHaveLength(2);
    expect(problem.codeTemplates.cpp.driver).toBe('int main(){}');
  });
});

describe('POST /api/problems', () => {
  const body = { title: 'New One', slug: 'New-One', difficulty: 'Medium', description: 'Do the thing' };

  it('lets admins create problems and lowercases the slug', async () => {
    const admin = await createUser({ role: 'admin' });

    const res = await request(app).post('/api/problems').set('Authorization', authFor(admin).bearer).send(body);

    expect(res.status).toBe(201);
    expect(res.body.slug).toBe('new-one');
    expect(await Problem.countDocuments()).toBe(1);
  });

  it('returns 403 for non-admin users', async () => {
    const user = await createUser();

    const res = await request(app).post('/api/problems').set('Authorization', authFor(user).bearer).send(body);

    expect(res.status).toBe(403);
    expect(await Problem.countDocuments()).toBe(0);
  });

  it('returns 401 without authentication', async () => {
    const res = await request(app).post('/api/problems').send(body);
    expect(res.status).toBe(401);
  });

  it('returns 400 for an invalid difficulty', async () => {
    const admin = await createUser({ role: 'admin' });

    const res = await request(app)
      .post('/api/problems')
      .set('Authorization', authFor(admin).bearer)
      .send({ ...body, difficulty: 'Impossible' });

    expect(res.status).toBe(400);
  });
});
