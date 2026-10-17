const { EventEmitter } = require('events');

// Stand-in for config/redispubsub. It is an EventEmitter, so tests can
// simulate a worker publishing a job update with
// pubsub.emit('message', channel, JSON.stringify(payload)).
const pubsub = new EventEmitter();
pubsub.subscribe = jest.fn(async () => 1);
pubsub.unsubscribe = jest.fn(async () => 0);
pubsub.publish = jest.fn(async () => 1);

module.exports = pubsub;
