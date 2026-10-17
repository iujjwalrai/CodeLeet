const WebSocket = require("ws");
const connectionPubSub = require("./config/redispubsub");
const cache = require("./config/redis"); // for reading cached job statuses

/**
 * jobId -> { ws, channel }
 */
const clients = new Map();
let wss = null;

async function subscribe(jobId, ws, channel) {
  clients.set(jobId, { ws, channel });
  connectionPubSub.subscribe(channel);

  // Replay cached status if the worker already published before WS was ready
  const cached = await cache.get(`job-cache:${channel}`);
  if (cached && ws.readyState === WebSocket.OPEN) {
    ws.send(cached);
  }
}


function cleanup(ws) {
  for (const [jobId, entry] of clients.entries()) {
    if (entry.ws === ws) {
      connectionPubSub.unsubscribe(entry.channel);
      clients.delete(jobId);
    }
  }
}

function handleRun(jobId, ws) {
  subscribe(jobId, ws, `job-updates:${jobId}`);
}

function handleSubmit(jobId, ws) {
  subscribe(jobId, ws, `job-updates-submission:${jobId}`);
}

const handlers = {
  RUN: handleRun,
  SUBMIT: handleSubmit,
};


function initWebSocket(server) {
  wss = new WebSocket.Server({ server });

  wss.on("connection", (ws) => {
    ws.on("message", (raw) => {
      try {
        const { type, jobId } = JSON.parse(raw.toString());
        if (!type || !jobId) return;

        const handler = handlers[type];
        if (!handler) return;

        handler(jobId, ws);
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
      const { jobId } = JSON.parse(message);

      const entry = clients.get(jobId);
      if(entry && entry.ws.readyState===WebSocket.OPEN){
        entry.ws.send(message);
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
