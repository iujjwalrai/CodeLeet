const request = require('supertest');
const app = require('../../app');

describe('app', () => {
  it('GET /api/health reports ok', async () => {
    const res = await request(app).get('/api/health');

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.instance).toBe(require('os').hostname());
    expect(new Date(res.body.timestamp).toString()).not.toBe('Invalid Date');
  });

  it('returns JSON 404 for unknown routes', async () => {
    const res = await request(app).get('/api/does-not-exist');

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ message: 'Not found' });
  });

  it.each(['http://localhost:5173', 'https://codeleet.me', 'http://frontend.test'])(
    'allows CORS with credentials from %s',
    async (origin) => {
      const res = await request(app).get('/api/health').set('Origin', origin);

      expect(res.headers['access-control-allow-origin']).toBe(origin);
      expect(res.headers['access-control-allow-credentials']).toBe('true');
    },
  );

  it('does not allow CORS from unknown origins', async () => {
    const res = await request(app).get('/api/health').set('Origin', 'https://evil.example');
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('rejects JSON bodies over 1mb', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .set('Content-Type', 'application/json')
      .send(JSON.stringify({ email: 'a@b.co', password: 'x'.repeat(1.1 * 1024 * 1024) }));

    expect(res.status).toBe(413);
  });
});
