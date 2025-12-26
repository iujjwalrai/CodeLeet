// /docker/runPython.js
const fs = require("fs");
const path = require("path");
const { exec } = require("child_process");
const { v4: uuid } = require("uuid");

module.exports = function runPython(code) {
  return new Promise((resolve) => {
    const id = uuid();
    const folder = path.join(__dirname, "temp", id);
    const filePath = path.join(folder, "main.py");

    fs.mkdirSync(folder, { recursive: true });
    fs.writeFileSync(filePath, code);

    const command = `docker run --rm -m 256m --cpus="0.5" -v ${folder}:/app python-runner`;

    const startTime = Date.now();

    exec(command, { timeout: 5000 }, (error, stdout, stderr) => {
      const time = (Date.now() - startTime) / 1000;

      if (error) {
        resolve({
          status: "runtime_error",
          output: stdout,
          error: stderr || error.message,
          time
        });
      } else {
        resolve({
          status: "success",
          output: stdout,
          error: stderr,
          time
        });
      }
    });
  });
};
