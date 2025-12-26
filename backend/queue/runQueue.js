require("dotenv").config();
const { Queue } = require("bullmq");
const connection = require("../config/redis");

const runQueue = new Queue("run-queue", {
  connection, metrics: { collect: false },
});

module.exports = runQueue;
