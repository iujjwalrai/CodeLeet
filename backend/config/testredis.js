// testRedis.js
const Redis = require("ioredis");
require("dotenv").config();

const r = new Redis(process.env.REDIS_URL, {
  tls: {},
  connectTimeout: 5000,
});

r.ping()
  .then(res => {
    console.log("Redis connected:", res);
    process.exit(0);
  })
  .catch(err => {
    console.log
    console.error("Redis failed:", err.message);
    process.exit(1);
  });
