const crypto = require('crypto');
const mongoose = require('mongoose');

// Gives each test file its own database on the shared in-memory server.
const connect = async () => {
  const dbName = `codeleet-test-${crypto.randomUUID()}`;
  await mongoose.connect(process.env.MONGO_TEST_URI, { dbName });
  await Promise.all(Object.values(mongoose.models).map(buildIndexes));
};

// User declares email/username both as `unique: true` and again via
// schema.index() without unique. Mongo builds the unique index first and
// rejects the duplicate definition (IndexKeySpecsConflict); the unique
// indexes the tests rely on are already in place by then.
const INDEX_KEY_SPECS_CONFLICT = 86;
const buildIndexes = (model) =>
  model.init().catch((err) => {
    if (err.code !== INDEX_KEY_SPECS_CONFLICT) throw err;
  });

const clear = async () => {
  const collections = await mongoose.connection.db.collections();
  await Promise.all(collections.map((collection) => collection.deleteMany({})));
};

const disconnect = async () => {
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
};

// Registers connect/clear/disconnect hooks for the calling test file.
const useTestDb = () => {
  beforeAll(connect);
  afterEach(clear);
  afterAll(disconnect);
};

module.exports = { connect, clear, disconnect, useTestDb };
