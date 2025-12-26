const Redis = require("ioredis");
const connectionPubSub = new Redis(process.env.REDIS_URL, {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
  tls: {},
});

module.exports = connectionPubSub;
