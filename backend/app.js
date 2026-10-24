const os = require('os');
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const passport = require('passport');
const connectDB = require('./config/db');
const { initWebSocket} = require("./wsServer");
const http = require('http');
const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const problemRoutes = require('./routes/problemRoutes');
const submissionRoutes = require('./routes/submissionRoutes');
const connectionPubSub = require("./config/redispubsub");
const cache = require("./config/redis");
require("./config/passport");
connectDB();
const app = express();
app.use(passport.initialize())
const allowedOrigins = [
  'http://localhost:5173',
  'https://codeleet.me',
  'https://codeleet-4cpe.onrender.com'
];

if (process.env.FRONTEND_URL && !allowedOrigins.includes(process.env.FRONTEND_URL)) {
  allowedOrigins.push(process.env.FRONTEND_URL);
}

app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
  }),
);

app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());
app.use(passport.initialize());

// The process is up. `instance` (the container's hostname) shows which
// replica answered when several run behind the gateway.
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', instance: os.hostname(), timestamp: new Date().toISOString() });
});

const READY_TIMEOUT_MS = 2000;

// Whether `check` succeeds within READY_TIMEOUT_MS. Commands to an
// unreachable Redis wait in its offline queue, so they need the timeout.
const passes = async (check) => {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error('timeout')), READY_TIMEOUT_MS);
  });
  try {
    await Promise.race([check(), timeout]);
    return true;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
};

// This replica can serve requests: MongoDB and Redis both answer. The Docker
// healthcheck uses it, so traffic only reaches replicas that are ready.
app.get('/api/ready', async (req, res) => {
  const [mongo, redis] = await Promise.all([
    passes(async () => {
      if (mongoose.connection.readyState !== 1) throw new Error('not connected');
      await mongoose.connection.db.admin().ping();
    }),
    passes(() => cache.ping()),
  ]);
  const ready = mongo && redis;
  res.status(ready ? 200 : 503).json({ status: ready ? 'ready' : 'not_ready', mongo, redis, instance: os.hostname() });
});

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/problems', problemRoutes);
app.use('/api/submissions', submissionRoutes);

app.use((req, res) => {
  res.status(404).json({ message: 'Not found' });
});

app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(err.status || 500).json({
    message: err.message || 'Unexpected error',
  });
});
const server = http.createServer(app);
initWebSocket(server);
module.exports = server;

