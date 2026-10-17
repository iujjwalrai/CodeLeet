const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../../app');
const User = require('../../models/User');
const { useTestDb } = require('../helpers/db');
const { createUser, createProblem, createSubmission, authFor } = require('../helpers/factories');

useTestDb();

const cookieFrom = (res) => (res.headers['set-cookie'] || []).find((c) => c.startsWith('codeleet_token='));

describe('POST /api/auth/register', () => {
  const valid = { fullName: 'Grace Hopper', email: 'Grace@Example.com', password: 'cobol123' };

  it('creates the user, returns a token and sets the auth cookie', async () => {
    const res = await request(app).post('/api/auth/register').send(valid);

    expect(res.status).toBe(201);
    expect(res.body.user).toMatchObject({
      fullName: 'Grace Hopper',
      email: 'grace@example.com',
      username: 'gracehopper',
      authProvider: 'local',
    });
    expect(res.body.user).not.toHaveProperty('password');
    expect(jwt.verify(res.body.token, process.env.JWT_SECRET).sub).toBe(res.body.user.id);
    expect(cookieFrom(res)).toMatch(/HttpOnly/);

    const stored = await User.findOne({ email: 'grace@example.com' });
    expect(stored.password).not.toBe('cobol123');
  });

  it.each([
    ['missing fullName', { ...valid, fullName: '' }],
    ['invalid email', { ...valid, email: 'not-an-email' }],
    ['short password', { ...valid, password: '12345' }],
  ])('returns 400 for %s', async (_label, body) => {
    const res = await request(app).post('/api/auth/register').send(body);

    expect(res.status).toBe(400);
    expect(res.body.errors.length).toBeGreaterThan(0);
  });

  it('returns 409 when the email is already registered (case-insensitive)', async () => {
    await createUser({ email: 'grace@example.com' });

    const res = await request(app).post('/api/auth/register').send(valid);

    expect(res.status).toBe(409);
  });
});

describe('POST /api/auth/login', () => {
  it('logs in with the right credentials and records lastLoginAt', async () => {
    const user = await createUser({ email: 'alan@example.com', password: 'enigma42' });

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'ALAN@example.com', password: 'enigma42' });

    expect(res.status).toBe(200);
    expect(res.body.user.id).toBe(user._id.toString());
    expect(cookieFrom(res)).toBeDefined();
    expect((await User.findById(user._id)).lastLoginAt).toBeInstanceOf(Date);
  });

  it('returns 401 for a wrong password', async () => {
    await createUser({ email: 'alan@example.com', password: 'enigma42' });

    const res = await request(app).post('/api/auth/login').send({ email: 'alan@example.com', password: 'nope' });

    expect(res.status).toBe(401);
    expect(res.body.message).toBe('Invalid credentials');
  });

  it('returns 401 for an unknown email', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: 'ghost@example.com', password: 'x' });
    expect(res.status).toBe(401);
  });

  it('refuses password login for Google accounts', async () => {
    await createUser({ email: 'g@example.com', password: undefined, authProvider: 'google' });

    const res = await request(app).post('/api/auth/login').send({ email: 'g@example.com', password: 'anything' });

    expect(res.status).toBe(401);
  });

  it('returns 400 when fields are missing', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: 'bad' });
    expect(res.status).toBe(400);
  });
});

describe('auth middleware (via GET /api/auth/me)', () => {
  it('accepts a Bearer token', async () => {
    const user = await createUser();
    const res = await request(app).get('/api/auth/me').set('Authorization', authFor(user).bearer);

    expect(res.status).toBe(200);
    expect(res.body.user.id).toBe(user._id.toString());
  });

  it('accepts the auth cookie', async () => {
    const user = await createUser();
    const res = await request(app).get('/api/auth/me').set('Cookie', authFor(user).cookie);

    expect(res.status).toBe(200);
  });

  it('returns 401 without a token', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
    expect(res.body.message).toBe('Authentication required');
  });

  it('returns 401 for a token signed with another secret', async () => {
    const user = await createUser();
    const forged = jwt.sign({ sub: user._id.toString() }, 'wrong-secret');

    const res = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${forged}`);

    expect(res.status).toBe(401);
  });

  it('returns 401 for an expired token', async () => {
    const user = await createUser();
    const expired = jwt.sign({ sub: user._id.toString() }, process.env.JWT_SECRET, { expiresIn: -10 });

    const res = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${expired}`);

    expect(res.status).toBe(401);
  });

  it('returns 401 when the user no longer exists', async () => {
    const user = await createUser();
    const { bearer } = authFor(user);
    await User.deleteOne({ _id: user._id });

    const res = await request(app).get('/api/auth/me').set('Authorization', bearer);

    expect(res.status).toBe(401);
    expect(res.body.message).toBe('Invalid token');
  });
});

describe('POST /api/auth/logout', () => {
  it('clears the auth cookie', async () => {
    const user = await createUser();
    const res = await request(app).post('/api/auth/logout').set('Authorization', authFor(user).bearer);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(cookieFrom(res)).toMatch(/Expires=Thu, 01 Jan 1970/);
  });
});

describe('GET /api/auth/me/recent', () => {
  it("returns the user's 4 most recent submissions with problem info", async () => {
    const user = await createUser();
    const other = await createUser();
    const problem = await createProblem({ title: 'Two Sum' });

    for (let i = 0; i < 6; i++) {
      await createSubmission(user, problem, { createdAt: new Date(2026, 0, i + 1) });
    }
    await createSubmission(other, problem);

    const res = await request(app).get('/api/auth/me/recent').set('Authorization', authFor(user).bearer);

    expect(res.status).toBe(200);
    expect(res.body.submissions).toHaveLength(4);
    expect(res.body.submissions[0].problem.title).toBe('Two Sum');
    expect(res.body.submissions[0]).not.toHaveProperty('code');
    const dates = res.body.submissions.map((s) => new Date(s.createdAt).getTime());
    expect(dates).toEqual([...dates].sort((a, b) => b - a));
  });
});

describe('GET /api/auth/me/heatmap', () => {
  it('returns 84 consecutive days with per-day submission counts', async () => {
    const user = await createUser();
    const problem = await createProblem();
    const today = new Date();
    const old = new Date(Date.now() - 200 * 24 * 60 * 60 * 1000);

    await createSubmission(user, problem, { createdAt: today });
    await createSubmission(user, problem, { createdAt: today });
    await createSubmission(user, problem, { createdAt: old });

    const res = await request(app).get('/api/auth/me/heatmap').set('Authorization', authFor(user).bearer);

    expect(res.status).toBe(200);
    expect(res.body.heatmap).toHaveLength(84);
    const total = res.body.heatmap.reduce((sum, d) => sum + d.count, 0);
    expect(total).toBe(2);
    expect(res.body.heatmap.at(-1)).toEqual({ date: today.toISOString().split('T')[0], count: 2 });
  });
});
