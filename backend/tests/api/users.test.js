const request = require('supertest');
const app = require('../../app');
const User = require('../../models/User');
const { useTestDb } = require('../helpers/db');
const { createUser, authFor } = require('../helpers/factories');

useTestDb();

describe('PATCH /api/users/me', () => {
  it('updates profile fields and merges preferences', async () => {
    const user = await createUser();

    const res = await request(app)
      .patch('/api/users/me')
      .set('Authorization', authFor(user).bearer)
      .send({
        fullName: 'Renamed Person',
        bio: 'I like graphs',
        location: 'Bengaluru',
        preferences: { defaultLanguage: 'cpp' },
      });

    expect(res.status).toBe(200);
    expect(res.body.user).toMatchObject({
      fullName: 'Renamed Person',
      bio: 'I like graphs',
      location: 'Bengaluru',
      preferences: { defaultLanguage: 'cpp', theme: 'dark', editorTheme: 'vs-dark' },
    });

    const stored = await User.findById(user._id);
    expect(stored.preferences.defaultLanguage).toBe('cpp');
  });

  it('changes the username (lowercased) when it is free', async () => {
    const user = await createUser();

    const res = await request(app)
      .patch('/api/users/me')
      .set('Authorization', authFor(user).bearer)
      .send({ username: 'New_Handle' });

    expect(res.status).toBe(200);
    expect(res.body.user.username).toBe('new_handle');
  });

  it('returns 409 when the username is taken', async () => {
    await createUser({ username: 'taken' });
    const user = await createUser();

    const res = await request(app)
      .patch('/api/users/me')
      .set('Authorization', authFor(user).bearer)
      .send({ username: 'taken' });

    expect(res.status).toBe(409);
  });

  it.each([
    ['a username with spaces', { username: 'bad name' }],
    ['a full name under 3 characters', { fullName: 'Al' }],
  ])('returns 400 for %s', async (_label, body) => {
    const user = await createUser();

    const res = await request(app).patch('/api/users/me').set('Authorization', authFor(user).bearer).send(body);

    expect(res.status).toBe(400);
  });

  it('requires authentication', async () => {
    const res = await request(app).patch('/api/users/me').send({ bio: 'x' });
    expect(res.status).toBe(401);
  });
});

describe('GET /api/users/stats', () => {
  it("returns the caller's stats", async () => {
    const user = await createUser({ stats: { problemsSolved: 7, totalSubmissions: 20 } });

    const res = await request(app).get('/api/users/stats').set('Authorization', authFor(user).bearer);

    expect(res.status).toBe(200);
    expect(res.body.stats).toMatchObject({ problemsSolved: 7, totalSubmissions: 20 });
  });
});
