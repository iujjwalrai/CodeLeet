require('dotenv').config();

const mongoose = require('mongoose');
const server = require('./app');
const { closeWebSocket } = require('./wsServer');
const redis = require('./config/redis');
const redisPubSub = require('./config/redispubsub');
const gracefulShutdown = require('./utils/gracefulShutdown');

const PORT = process.env.PORT || 5000;
// 0.0.0.0 so the API is reachable from outside a container; set HOST=127.0.0.1
// to keep it local-only.
const HOST = process.env.HOST || '0.0.0.0';

server.listen(PORT, HOST, () => {
  console.log(`CodeLeet API listening on ${HOST}:${PORT}`);
});

gracefulShutdown('api', async () => {
  // Stop new HTTP connections and WebSocket upgrades, let in-flight requests
  // finish, then release Redis and MongoDB.
  const httpClosed = new Promise((resolve) => server.close(resolve));
  await closeWebSocket();
  await httpClosed;
  await Promise.allSettled([redis.quit(), redisPubSub.quit()]);
  await mongoose.disconnect();
});
