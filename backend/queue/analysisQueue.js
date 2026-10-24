require("dotenv").config();
const { Queue } = require("bullmq");
const connection = require("../config/redis");

// Low-priority work after a verdict, run by worker/analysisWorker.js
const analysisQueue = new Queue("analysis-queue", {
  connection, metrics: { collect: false },
});

module.exports = analysisQueue;
