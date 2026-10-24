// Stand-in for config/redis (the cache / BullMQ connection).
module.exports = {
  get: jest.fn(async () => null),
  set: jest.fn(async () => 'OK'),
  publish: jest.fn(async () => 1),
  ping: jest.fn(async () => 'PONG'),
};
