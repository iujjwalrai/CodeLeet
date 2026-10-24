require("dotenv").config();
const { Worker } = require("bullmq");
const mongoose = require("mongoose");
const connectDB = require("../config/db");
const connection = require("../config/redis");
const pubsub = require("../config/redispubsub");
const cache = require("../config/redis");
const Problem = require("../models/Problem");
const Submission = require("../models/Submission");
const gracefulShutdown = require("../utils/gracefulShutdown");
const { analyzeComplexity } = require("../problemkit/complexity");

/*
 * Low-priority analysis after a verdict: times Accepted submissions at
 * growing sizes and fits a complexity class (problemkit/complexity.js).
 * One job at a time, in its own service, so judging never waits for it.
 */

// Sent on the submission's channel after its verdict, as Phase 3's ANALYSIS is
async function publishComplexity(jobId, complexity) {
  const channel = `job-updates-submission:${jobId}`;
  const payload = JSON.stringify({ jobId, data: { type: "COMPLEXITY", ...complexity } });
  await cache.set(`job-cache:${channel}:complexity`, payload, "EX", 60);
  // A late subscriber gets the verdict already holding the result
  const verdict = await cache.get(`job-cache:${channel}`);
  if (verdict) {
    const cached = JSON.parse(verdict);
    cached.data.complexityPending = false;
    cached.data.complexity = complexity;
    await cache.set(`job-cache:${channel}`, JSON.stringify(cached), "EX", 60);
  }
  await pubsub.publish(channel, payload);
}

async function processAnalysis(job) {
  const { submissionId, jobId } = job.data;
  const submission = await Submission.findById(submissionId).select("code language problem status").lean();
  let complexity;
  if (!submission || submission.status !== "accepted") {
    complexity = { status: "skipped", reason: "Only Accepted submissions are analysed." };
  } else {
    const problem = await Problem.findById(submission.problem).select("+analysisTools timeLimitMs").lean();
    complexity = await analyzeComplexity({ problem, language: submission.language, code: submission.code });
  }
  if (submission) {
    try {
      await Submission.updateOne({ _id: submissionId }, { $set: { "analysis.complexity": complexity } });
    } catch (err) {
      console.error("Unable to save complexity analysis:", err.message);
    }
  }
  await publishComplexity(jobId, complexity);
  return { status: complexity.status };
}

if (require.main === module) {
  connectDB();

  const worker = new Worker("analysis-queue", processAnalysis, { connection, concurrency: 1, metrics: { collect: false } });

  gracefulShutdown("analysis-worker", async () => {
    await worker.close();
    await Promise.allSettled([connection.quit(), pubsub.quit()]);
    await mongoose.disconnect();
  }, { timeoutMs: process.env.SHUTDOWN_TIMEOUT_MS || 30000 });

  console.log("Analysis worker is listening...");
}

module.exports = { processAnalysis };
