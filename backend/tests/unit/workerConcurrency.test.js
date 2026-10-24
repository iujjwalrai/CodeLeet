const workerConcurrency = require('../../utils/workerConcurrency');

describe('workerConcurrency', () => {
  it('reads WORKER_CONCURRENCY', () => {
    expect(workerConcurrency({ WORKER_CONCURRENCY: '4' })).toBe(4);
  });

  it.each([undefined, '', '0', '-2', '1.5', 'many'])('falls back to 1 for %p', (value) => {
    expect(workerConcurrency({ WORKER_CONCURRENCY: value })).toBe(1);
  });
});
