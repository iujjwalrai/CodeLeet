const os = require('os');
const mongoose = require('mongoose');
const request = require('supertest');
const app = require('../../app');
const cache = require('../../config/redis');
const { useTestDb } = require('../helpers/db');

useTestDb();

describe('GET /api/ready', () => {
  it('is ready when MongoDB and Redis both answer', async () => {
    const res = await request(app).get('/api/ready');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ready', mongo: true, redis: true, instance: os.hostname() });
  });

  it('is not ready when MongoDB fails', async () => {
    const admin = jest.spyOn(mongoose.connection.db, 'admin')
      .mockReturnValue({ ping: () => Promise.reject(new Error('connection lost')) });
    try {
      const res = await request(app).get('/api/ready');

      expect(res.status).toBe(503);
      expect(res.body).toMatchObject({ status: 'not_ready', mongo: false, redis: true });
    } finally {
      admin.mockRestore();
    }
  });

  it('is not ready when Redis fails', async () => {
    cache.ping.mockRejectedValueOnce(new Error('ECONNREFUSED'));

    const res = await request(app).get('/api/ready');

    expect(res.status).toBe(503);
    expect(res.body).toMatchObject({ status: 'not_ready', mongo: true, redis: false });
  });

  // Waits out the real 2 s timeout
  it('gives up on a Redis that never answers', async () => {
    cache.ping.mockReturnValueOnce(new Promise(() => {}));

    const res = await request(app).get('/api/ready');

    expect(res.status).toBe(503);
    expect(res.body.redis).toBe(false);
  });
});
