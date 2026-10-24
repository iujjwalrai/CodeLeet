const WebSocket = require("ws");
const connectionPubSub = require("./config/redispubsub");
const cache = require("./config/redis"); // for reading cached job statuses

/**
 * Full channel -> subscribers. Run and Submit queue IDs can overlap.
 */
const clients = new Map();
let wss = null;

async function subscribe(jobId, ws, channel) {
  if (!clients.has(channel)) {
    clients.set(channel, new Set());
    await connectionPubSub.subscribe(channel);
  }
  clients.get(channel).add(ws);
  if (ws.readyState !== WebSocket.OPEN) { cleanup(ws); return; }

  // Replay cached status if the worker already published before WS was ready
  const cached = await cache.get(`job-cache:${channel}`);
  if (cached && ws.readyState === WebSocket.OPEN) {
    ws.send(cached);
  }
  const analysis = await cache.get(`job-cache:${channel}:analysis`);
  if (analysis && ws.readyState === WebSocket.OPEN) ws.send(analysis);
}


function cleanup(ws) {
  for (const [channel, subscribers] of clients.entries()) {
    if (subscribers.delete(ws) && !subscribers.size) {
      connectionPubSub.unsubscribe(channel);
      clients.delete(channel);
    }
  }
}

function handleRun(jobId, ws) {
  return subscribe(jobId, ws, `job-updates:${jobId}`);
}

function handleSubmit(jobId, ws) {
  return subscribe(jobId, ws, `job-updates-submission:${jobId}`);
}

const handlers = {
  RUN: handleRun,
  SUBMIT: handleSubmit,
};


function initWebSocket(server) {
  wss = new WebSocket.Server({ server });

  wss.on("connection", (ws) => {
    ws.on("message", async (raw) => {
      try {
        const { type, jobId } = JSON.parse(raw.toString());
        if (!type || !jobId) return;

        const handler = handlers[type];
        if (!handler) return;

        await handler(jobId, ws);
      } catch (err) {
        console.error("WebSocket message error:", err.message);
      }
    });

    ws.on("close", () => {
      cleanup(ws);
      console.log("WebSocket connection closed");
    });
  });

  /* ================= REDIS → WS ================= */

  // Forward-only: the submission worker saves verdicts to MongoDB itself, so
  // a result is stored whether or not anyone is connected.
  connectionPubSub.on("message", (channel, message) => {
    try {
      JSON.parse(message);
      for (const ws of clients.get(channel) || []) {
        if (ws.readyState === WebSocket.OPEN) ws.send(message);
      }
    } catch (err) {
      console.error("Redis parsing error:", err.message);
    }
  });
}

// Used on shutdown: tells clients the server is going away (1001) so they can
// reconnect elsewhere, and stops accepting new upgrades.
function closeWebSocket() {
  if (!wss) return Promise.resolve();
  for (const client of wss.clients) {
    client.close(1001, "Server shutting down");
  }
  return new Promise((resolve) => wss.close(() => resolve()));
}

module.exports = { initWebSocket, closeWebSocket };
