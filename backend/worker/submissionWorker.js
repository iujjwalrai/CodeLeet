require("dotenv").config();
const { Worker } = require("bullmq");
const mongoose = require("mongoose");
const connectDB = require("../config/db");
const connection = require("../config/redis");
const connectionPubSub = require("../config/redispubsub");
const Submission = require("../models/Submission");
const runPython = require("../docker/runPython");
const runJava = require("../docker/runJava");
const runJavaScript = require("../docker/runJavaScript");
const runCpp = require("../docker/runCpp");
const cache = require("../config/redis");
const gracefulShutdown = require("../utils/gracefulShutdown");

// Statuses the Submission model can store; anything else (e.g. "error") is
// only published, as before.
const FINAL_STATUSES = new Set([
  "accepted",
  "wrong_answer",
  "compilation_error",
  "runtime_error",
]);

async function publishJobUpdate(jobId, data) {
  const payload = JSON.stringify({ jobId, data });
  const channel = `job-updates-submission:${jobId}`;
  await cache.set(`job-cache:${channel}`, payload, "EX", 60);
  connectionPubSub.publish(channel, payload);
}

// Saved here rather than in the WebSocket server so the verdict is stored
// exactly once, even if the user closed the tab or several API replicas run.
async function saveVerdict(submissionId, result) {
  if (!FINAL_STATUSES.has(result.status)) return;

  const tc = result.failedTestCase;
  await Submission.updateOne(
    { _id: submissionId },
    {
      status: result.status,
      output: result.output,
      error: result.error,
      time: result.time,
      memory: result.memory,
      failedTestCase: tc
        ? { input: tc.input, expected: tc.output, output: result.output }
        : undefined,
    }
  );
}

async function processSubmission(job) {
    const { submissionId, code, language, problem } = job.data;

    console.log("Worker started for job:", submissionId);


    let result;

    try {
      const template = problem.codeTemplates[language];
      if (!template) {
        throw new Error(`Language ${language} not supported for this problem`);
      }

      const payload = {
        userCode: code,
        starterCode: template.starter,
        driverCode: template.driver,
        testCases: problem.testCases,
      };

      switch (language) {
        case "java":
          publishJobUpdate(job.id, {
            type:"SUBMIT",
            status: "Running"
          })
          result = await runJava(payload);
          break;

        case "python":
          publishJobUpdate(job.id, {
            type:"SUBMIT",
            status: "Running"
          })
          result = await runPython(payload);
          break;

        case "javascript":
          publishJobUpdate(job.id, {
            type:"SUBMIT",
            status: "Running"
          })
          result = await runJavaScript(payload);
          break;

        case "cpp":
          publishJobUpdate(job.id, {
            type:"SUBMIT",
            status: "Running"
          })
          result = await runCpp(payload);
          break;

        default:
          throw new Error("Unsupported language");
      }

      console.log({
        type: "SUBMIT",
        submissionId,
        status: result.status,
        passedCount: result.passedCount,
        totalCount: result.totalCount,
        failedTestCase: result.failedTestCase,
        failedTestCaseIndex: result.failedTestCaseIndex,
        output: result.output || "",
        error: result.error || "",
        time: result.time || 0,
        memory: result.memory || 0,
      })

      // Save before publishing so a client that refetches on the final
      // update already sees the stored verdict.
      await saveVerdict(submissionId, result);

      publishJobUpdate(job.id, {
        type: "SUBMIT",
        submissionId,
        status: result.status,
        passedCount: result.passedCount,
        totalCount: result.totalCount,
        failedTestCase: result.failedTestCase,
        failedTestCaseIndex: result.failedTestCaseIndex,
        output: result.output || "",
        error: result.error || "",
        time: result.time || 0,
        memory: result.memory || 0,
      });
      return {
        type: "SUBMIT",
        submissionId,
        status: result.status,
        passedCount: result.passedCount,
        totalCount: result.totalCount,
        failedTestCase: result.failedTestCase,
        failedTestCaseIndex: result.failedTestCaseIndex,
        output: result.output || "",
        error: result.error || "",
        time: result.time || 0,
        memory: result.memory || 0,
      };

    } catch (err) {
      console.error("Worker error:", err);

      publishJobUpdate(job.id,{
        type:"SUBMIT",
        submissionId,
        status: "error",
        output: "",
        error: err.message,
        time: 0,
        memory: 0,
      });
      return {
        type:"SUBMIT",
        submissionId,
        status: "error",
        output: "",
        error: err.message,
        time: 0,
        memory: 0,
      };
    }
}

if (require.main === module) {
  connectDB();

  const worker = new Worker(
    "submission-queue",
    processSubmission,
    { connection, metrics: { collect: false }, }
  );

  // A submission can run many test cases, so allow longer than the API's 10s
  // to finish the current job before exiting.
  gracefulShutdown("submission-worker", async () => {
    await worker.close();
    await Promise.allSettled([connection.quit(), connectionPubSub.quit()]);
    await mongoose.disconnect();
  }, { timeoutMs: process.env.SHUTDOWN_TIMEOUT_MS || 30000 });

  console.log("Worker is listening...");
}

module.exports = { processSubmission };
