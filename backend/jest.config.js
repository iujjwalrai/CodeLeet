module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  testMatch: ['**/*.test.js'],
  globalSetup: '<rootDir>/tests/setup/globalSetup.js',
  globalTeardown: '<rootDir>/tests/setup/globalTeardown.js',
  setupFiles: ['<rootDir>/tests/setup/env.js'],
  setupFilesAfterEnv: ['<rootDir>/tests/setup/silenceConsole.js'],
  // Redis, BullMQ queues and the real Mongo connection are swapped for test
  // doubles so the suite runs without any external services.
  moduleNameMapper: {
    '^(\\.{1,2}/)+config/db$': '<rootDir>/tests/mocks/db.js',
    '^(\\.{1,2}/)+config/redis$': '<rootDir>/tests/mocks/redis.js',
    '^(\\.{1,2}/)+config/redispubsub$': '<rootDir>/tests/mocks/redispubsub.js',
    '^(\\.{1,2}/)+queue/runQueue$': '<rootDir>/tests/mocks/queue.js',
    '^(\\.{1,2}/)+queue/submissionQueue$': '<rootDir>/tests/mocks/queue.js',
    '^(\\.{1,2}/)+queue/analysisQueue$': '<rootDir>/tests/mocks/queue.js',
  },
  clearMocks: true,
  collectCoverageFrom: [
    'controllers/**/*.js',
    'middleware/**/*.js',
    'utils/**/*.js',
    'models/**/*.js',
    'docker/**/*.js',
    'wsServer.js',
    'app.js',
  ],
  testTimeout: 20000,
};
