const WebSocket = require("ws");
const connectionPubSub = require("./config/redispubsub");
const Submission = require("./models/Submission");
const cache = require("./config/redis"); // for reading cached job statuses

/**
 * jobId -> { ws, channel }
 */
const clients = new Map();
const FINAL_STATUSES = new Set([
  "accepted",
  "wrong_answer",
  "compilation_error",
  "runtime_error",
]);

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
  const wss = new WebSocket.Server({ server });

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

  connectionPubSub.on("message", async (channel, message) => {
    try {
      const payload = JSON.parse(message);
      const {jobId, data} = payload;

      const {type, submissionId, status, tc, output, error, time, memory} = data;

      const entry = clients.get(jobId);
      if(entry && entry.ws.readyState===WebSocket.OPEN){
        entry.ws.send(message);
      }

      if(type==="SUBMIT" && FINAL_STATUSES.has(status)){
        await Submission.updateOne({_id: submissionId}, {status, output, error, time, memory, failedTestCase:
          tc ? {input: tc.input, expected: tc.output, output} : undefined
        });
        
      }

    } catch (err) {
      console.error("Redis parsing error:", err.message);
    }
  });
}

module.exports = { initWebSocket };
