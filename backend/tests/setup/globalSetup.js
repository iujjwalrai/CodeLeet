const { MongoMemoryServer } = require('mongodb-memory-server');

// One in-memory MongoDB for the whole run. Each test file connects to its own
// database on it (see tests/helpers/db.js), so files can run in parallel.
module.exports = async () => {
  const mongod = await MongoMemoryServer.create();
  globalThis.__MONGOD__ = mongod;
  process.env.MONGO_TEST_URI = mongod.getUri();
};
