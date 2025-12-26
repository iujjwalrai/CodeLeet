require("dotenv").config();
const { Queue } = require("bullmq");
const connection = require("../config/redis");

const submissionQueue = new Queue("submission-queue", {
  connection, metrics: { collect: false },
});

module.exports = submissionQueue;
