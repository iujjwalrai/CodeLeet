// Runs before every test file, ahead of any app module (and its dotenv call).
// dotenv never overrides variables that are already set, so these win over a
// local .env file.
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret';
process.env.JWT_EXPIRES_IN = '1h';
process.env.COOKIE_NAME = 'codeleet_token';
process.env.GOOGLE_CLIENT_ID = 'test-google-client-id';
process.env.GOOGLE_CLIENT_SECRET = 'test-google-client-secret';
process.env.FRONTEND_URL = 'http://frontend.test';
process.env.REDIS_URL = 'redis://redis.invalid:6379';
process.env.MONGODB_URI = 'mongodb://mongo.invalid:27017/unused';
