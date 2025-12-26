require("dotenv").config();
const { Worker } = require("bullmq");
const connection = require("../config/redis");
const connectionPubSub = require("../config/redispubsub");
const runPython = require("../docker/runPython");
const runJava = require("../docker/runJava");
const runJavaScript = require("../docker/runJavaScript");
const runCpp = require("../docker/runCpp");

function publishJobUpdate(jobId, data){
  connectionPubSub.publish(`job-updates-submission:${jobId}`, JSON.stringify({ jobId, data }) );
}

const worker = new Worker(
  "submission-queue",
  async (job) => {
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
            stauts: "Running"
          })
          result = await runJava(payload);
          break;

        case "python":
          publishJobUpdate(job.id, {
            type:"SUBMIT",
            stauts: "Running"
          })
          result = await runPython(payload);
          break;

        case "javascript":
          publishJobUpdate(job.id, {
            type:"SUBMIT",
            stauts: "Running"
          })
          result = await runJavaScript(payload);
          break;

        case "cpp":
          publishJobUpdate(job.id, {
            type:"SUBMIT",
            stauts: "Running"
          })
          result = await runCpp(payload);
          break;

        default:
          throw new Error("Unsupported language");
      }

      console.log({
        type:"SUBMIT",
        submissionId,
        status: result.status,
        failedTestCase: result.failedTestCase,
        output: result.output || "",
        error: result.error || "",
        time: result.time || 0,
        memory: result.memory || 0,
      })

      publishJobUpdate(job.id,{
        type:"SUBMIT",
        submissionId,
        status: result.status,
        failedTestCase: result.failedTestCase,
        output: result.output || "",
        error: result.error || "",
        time: result.time || 0,
        memory: result.memory || 0,
      });
      return {
        type:"SUBMIT",
        submissionId,
        status: result.status,
        failedTestCase: result.failedTestCase,
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
  },
  { connection, metrics: { collect: false }, }
);

console.log("Worker is listening...");
