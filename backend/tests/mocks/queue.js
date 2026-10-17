// Stand-in for the BullMQ queues. Both runQueue and submissionQueue map to
// this module, so tests can assert on queue.add calls.
let nextId = 1;

module.exports = {
  add: jest.fn(async () => ({ id: String(nextId++) })),
};
