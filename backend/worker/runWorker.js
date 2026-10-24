require("dotenv").config();
const { Worker } = require("bullmq");
const connection = require("../config/redis");
const connectionPubSub = require("../config/redispubsub");
const runPython = require("../docker/runPython");
const runJava = require("../docker/runJava");
const runJavaScript = require("../docker/runJavaScript");
const runCpp = require("../docker/runCpp");
const cache = require("../config/redis"); // separate client for SET commands
const gracefulShutdown = require("../utils/gracefulShutdown");
const workerConcurrency = require("../utils/workerConcurrency");
const { canAnalyze, analyzeFailure } = require("./counterexampleAnalysis");

async function publishJobUpdate(jobId, data) {
  const payload = JSON.stringify({ jobId, data });
  const channel = `job-updates:${jobId}`;
  // Pending analysis gets a longer replay window; completed data uses 60s.
  await cache.set(`job-cache:${channel}`, payload, "EX", data.analysisPending ? 180 : 60);
  await connectionPubSub.publish(channel, payload);
}
async function processRun(job) {
    const { code, language, input, problemId, problem } = job.data;

    console.log("Run worker started for job:", job.id);
    console.log(`Language: ${language}, Problem ID: ${problemId}`);


    // console.log(`Code : ${code}`);
    try {
      if (!problem) throw new Error("Problem not found");
      const template = problem.codeTemplates[language];
      if (!template) {
        throw new Error(`Language ${language} not supported`);
      }
      const payload = {
        userCode: code,
        starterCode: template.starter,
        driverCode: template.driver,
        input: input || "",
        testCases: problem.testCases,
        timeLimitMs: problem.timeLimitMs,
      };
      let result;

      switch (language) {
        case "java":
          publishJobUpdate(job.id, { status: "Running" });
          result = await runJava(payload);
          break;

        case "python":
          publishJobUpdate(job.id, { status: "Running" });
          result = await runPython(payload);
          break;

        case "javascript":
          publishJobUpdate(job.id, { status: "Running" });
          result = await runJavaScript(payload);
          break;

        case "cpp":
          publishJobUpdate(job.id, { status: "Running" });
          result = await runCpp(payload);
          break;

        default:
          throw new Error("Unsupported language");
      }

      console.log({
        status: result.status,
        passedCount: result.passedCount,
        totalCount: result.totalCount,
        output: result.output || "",
        error: result.error || "",
        time: result.time || 0,
        memory: result.memory || 0,
      });
      const analysisPending = canAnalyze(problem, language, result);
      await publishJobUpdate(job.id, {
        status: result.status,
        analysisPending,
        passedCount: result.passedCount,
        totalCount: result.totalCount,
        failedTestCase: result.failedTestCase,
        failedTestCaseIndex: result.failedTestCaseIndex,
        output: result.output || "",
        error: result.error || "",
        time: result.time || 0,
        memory: result.memory || 0,
        resources: result.resources || null,
      });
      if (analysisPending) {
        try {
          await analyzeFailure({ jobId: job.id, channel: `job-updates:${job.id}`, problem, code, language, result });
        } catch {
          console.error('Unable to publish counterexample analysis');
        }
      }
      return {
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
      console.error("Run worker error:", err.message);

      publishJobUpdate(job.id,{
        status: "error",
        output: "",
        error: err.message,
        time: 0,
        memory: 0,
      });
      return {
        status: "error",
        output: "",
        error: err.message,
        time: 0,
        memory: 0,
      };
    }
}

if (require.main === module) {
  const worker = new Worker("run-queue", processRun, { connection, concurrency: workerConcurrency(), metrics: { collect: false } });
  // Let the current run finish before exiting (see submissionWorker.js).
  gracefulShutdown("run-worker", async () => {
    await worker.close();
    await Promise.allSettled([connection.quit(), connectionPubSub.quit()]);
  }, { timeoutMs: process.env.SHUTDOWN_TIMEOUT_MS || 30000 });

  console.log("Run worker is listening...");
}

module.exports = { processRun };
