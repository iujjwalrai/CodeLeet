require("dotenv").config();
const Redis = require("ioredis");

// Use TLS only for Upstash (rediss://) — not needed for local Redis
const isTLS = process.env.REDIS_URL?.startsWith("rediss://");

const connectionPubSub = new Redis(process.env.REDIS_URL, {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
  ...(isTLS ? { tls: {} } : {}),
});

module.exports = connectionPubSub;
