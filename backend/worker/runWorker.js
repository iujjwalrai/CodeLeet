require("dotenv").config();
const { Worker } = require("bullmq");
const connection = require("../config/redis");
const connectionPubSub = require("../config/redispubsub");
const runPython = require("../docker/runPython");
const runJava = require("../docker/runJava");
const runJavaScript = require("../docker/runJavaScript");
const runCpp = require("../docker/runCpp");

function publishJobUpdate(jobId, data){
  connectionPubSub.publish(`job-updates:${jobId}`, JSON.stringify({ jobId, data }) );
}
const worker = new Worker(
  "run-queue",
  async (job) => {
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
        output: result.output || "",
        error: result.error || "",
        time: result.time || 0,
        memory: result.memory || 0,
      });
      publishJobUpdate(job.id,{
        status: result.status,
        tc: result.tc,
        output: result.output || "",
        error: result.error || "",
        time: result.time || 0,
        memory: result.memory || 0,
      });
      return {
        status: result.status,
        tc: result.tc,
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
  },
  { connection, metrics: { collect: false }, }
);

console.log("Run worker is listening...");
