const fs = require('fs');
const os = require('os');
const path = require('path');

// The runners shell out to `docker run`. Replace exec with a fake so the
// verdict logic can be tested without Docker.
jest.mock('child_process', () => ({ exec: jest.fn() }));
const { exec } = require('child_process');

const runCpp = require('../../docker/runCpp');
const runJava = require('../../docker/runJava');
const runPython = require('../../docker/runPython');

// handler(cmd, stdin) returns { stdout } | { stderr } | { error }.
const fakeDocker = (handler) => {
  exec.mockImplementation((cmd, _opts, callback) => {
    let stdin = '';
    const child = {
      stdin: {
        write: (chunk) => {
          stdin += chunk;
        },
        end: () => {},
      },
    };
    // The runner writes stdin synchronously after exec returns, so answer on
    // the next tick.
    setImmediate(() => {
      const { stdout = '', stderr = '', error = null } = handler(cmd, stdin);
      callback(error, stdout, stderr);
    });
    return child;
  });
};

// Real behaviour of the add-two-numbers solution: "1 2" -> "3".
const addNumbers = (stdin) => {
  const [a, b] = stdin.trim().split(/\s+/).map(Number);
  return `${a + b}\n`;
};

const commandFailed = (cmd, output) => new Error(`Command failed: ${cmd.trim()}\n\n${output}`);

const testCases = [
  { input: '1 2', output: '3' },
  { input: '5 5', output: '10' },
  { input: '-1 1', output: '0' },
];

let workRoot;
beforeEach(() => {
  workRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'codeleet-runner-test-'));
  jest.spyOn(process, 'cwd').mockReturnValue(workRoot);
});
afterEach(() => {
  process.cwd.mockRestore();
  fs.rmSync(workRoot, { recursive: true, force: true });
});

const leftoverJobDirs = () => fs.readdirSync(path.join(workRoot, 'tmp'));

// Fake cl-meter: reads the job the runner wrote (mounted at /app) and answers
// with a report like the real one. `test(input, i)` overrides fields of each
// test result; cl-meter stops after a time or memory limit, so does this.
const meterReport = (cmd, { compile = {}, test = (input) => ({ stdout: addNumbers(input) }) } = {}) => {
  const jobDir = cmd.match(/-v "([^"]+):\/app:ro"/)[1];
  const conf = Object.fromEntries(
    fs.readFileSync(path.join(jobDir, 'job.conf'), 'utf8').trim().split('\n')
      .map((line) => [line.slice(0, line.indexOf('=')), line.slice(line.indexOf('=') + 1)]),
  );
  const compileResult = { ran: true, ok: true, exit: 0, signal: 0, tle: false, wallMs: 120, log: '', ...compile };
  const tests = [];
  for (let i = 0; compileResult.ok && i < Number(conf.count); i++) {
    const input = fs.readFileSync(path.join(jobDir, 'tests', `${i}.in`), 'utf8');
    const t = {
      exit: 0, signal: 0, tle: false, mle: false, wallMs: 4 + i, cpuMs: 3 + i, peakKb: 2048 + i,
      stdout: '', stdoutTruncated: false, stderr: '', timeline: [[0, 100, 0], [3, 2048, 3]],
      ...test(input, i),
    };
    tests.push(t);
    if (t.tle || t.mle) break;
  }
  return { stdout: JSON.stringify({ version: 1, compile: compileResult, tests }) };
};

// Answers cl-meter jobs (C++/Java) and plain runs (Python) alike.
const anyRunner = (cmd, stdin) => (cmd.includes('cl-meter') ? meterReport(cmd) : { stdout: addNumbers(stdin) });

const dockerExit = (code, stderr) => Object.assign(new Error(`Command failed\n${stderr}`), { code });

describe.each([
  ['runCpp', runCpp, 'g++', 'codeleet-cpp', 'Solution.cpp:4:3: error: expected \';\'', ['Solution.cpp', 'Main.cpp']],
  ['runJava', runJava, 'javac', 'codeleet-java', 'Solution.java:4: error: \';\' expected', ['Solution.java', 'Main.java']],
])('%s', (_name, run, compiler, image, compilerError, codeFiles) => {
  const input = { userCode: 'user code', driverCode: 'driver code', testCases };

  it('returns accepted with the slowest time and highest memory across test cases', async () => {
    fakeDocker((cmd) => meterReport(cmd));

    const result = await run(input);

    expect(result).toMatchObject({ status: 'accepted', passedCount: 3, totalCount: 3, error: null, time: 6, memory: 2050 });
    expect(result.resources).toMatchObject({ testIndex: 2, peakKb: 2050, cpuMs: 5 });
    expect(result.resources.timeline).toEqual([{ t: 0, rssKb: 100, cpuMs: 0 }, { t: 3, rssKb: 2048, cpuMs: 3 }]);
  });

  it('runs everything in one container, with code, inputs and job config in the mounted folder', async () => {
    let job;
    fakeDocker((cmd) => {
      const jobDir = cmd.match(/-v "([^"]+):\/app:ro"/)[1];
      job = {
        files: fs.readdirSync(jobDir).sort(),
        inputs: testCases.map((_, i) => fs.readFileSync(path.join(jobDir, 'tests', `${i}.in`), 'utf8')),
        code: fs.readFileSync(path.join(jobDir, codeFiles[0]), 'utf8'),
        conf: fs.readFileSync(path.join(jobDir, 'job.conf'), 'utf8'),
      };
      return meterReport(cmd);
    });

    await run(input);

    expect(exec).toHaveBeenCalledTimes(1);
    expect(job.files).toEqual([...codeFiles, 'job.conf', 'tests'].sort());
    expect(job.inputs).toEqual(testCases.map((tc) => tc.input));
    expect(job.code).toBe('user code');
    expect(job.conf).toContain(`count=${testCases.length}`);
    expect(job.conf.split('\n').find((l) => l.startsWith('compile='))).toContain(compiler);
    expect(job.conf).toContain('stop_on_limit=1');
    // Expected outputs never go into the container
    expect(job.conf).not.toContain(testCases[1].output);
  });

  it('reports the first failing test case on wrong answer but keeps counting passes', async () => {
    fakeDocker((cmd) => meterReport(cmd, { test: (stdin) => ({ stdout: stdin === '5 5' ? '11\n' : addNumbers(stdin) }) }));

    const result = await run(input);

    expect(result).toMatchObject({
      status: 'wrong_answer',
      passedCount: 2,
      totalCount: 3,
      failedTestCaseIndex: 1,
      failedTestCase: testCases[1],
      output: '11',
      error: 'Expected: 10, Got: 11',
    });
  });

  it('ignores surrounding whitespace when comparing output', async () => {
    fakeDocker((cmd) => meterReport(cmd, { test: (stdin) => ({ stdout: `  ${addNumbers(stdin)}\n\n` }) }));

    await expect(run(input)).resolves.toMatchObject({ status: 'accepted' });
  });

  it('ignores stderr when the program exits normally', async () => {
    fakeDocker((cmd) => meterReport(cmd, { test: (stdin) => ({ stdout: addNumbers(stdin), stderr: 'debug: n=2' }) }));

    await expect(run(input)).resolves.toMatchObject({ status: 'accepted' });
  });

  it('returns compilation_error with the compiler output', async () => {
    fakeDocker((cmd) => meterReport(cmd, { compile: { ok: false, exit: 1, log: `${compilerError}\n` } }));

    const result = await run(input);

    expect(result).toMatchObject({ status: 'compilation_error', error: compilerError });
  });

  it('says so when compiling times out', async () => {
    fakeDocker((cmd) => meterReport(cmd, { compile: { ok: false, tle: true, signal: 9 } }));

    await expect(run(input)).resolves.toMatchObject({ status: 'compilation_error', error: 'Compilation timed out' });
  });

  it('returns runtime_error with stderr, or the signal when there is none', async () => {
    fakeDocker((cmd) => meterReport(cmd, { test: (_s, i) => (i === 1 ? { exit: 1, stderr: 'Exception: boom\n' } : { stdout: '3' }) }));
    await expect(run(input)).resolves.toMatchObject({ status: 'runtime_error', error: 'Exception: boom', failedTestCaseIndex: 1 });

    fakeDocker((cmd) => meterReport(cmd, { test: () => ({ signal: 11 }) }));
    await expect(run(input)).resolves.toMatchObject({ status: 'runtime_error', error: 'Program was killed by SIGSEGV' });

    fakeDocker((cmd) => meterReport(cmd, { test: () => ({ signal: 25 }) }));
    await expect(run(input)).resolves.toMatchObject({ status: 'runtime_error', error: 'Output limit exceeded (10 MB)' });
  });

  it('returns time_limit_exceeded and counts tests that never ran as failed', async () => {
    fakeDocker((cmd) => meterReport(cmd, { test: (stdin, i) => (i === 1 ? { tle: true, signal: 9, wallMs: 3001 } : { stdout: addNumbers(stdin) }) }));

    const result = await run(input);

    expect(result).toMatchObject({
      status: 'time_limit_exceeded',
      passedCount: 1,
      totalCount: 3,
      failedTestCaseIndex: 1,
      error: 'Time limit exceeded on test case 2 (limit 3000 ms)',
    });
  });

  it('returns memory_limit_exceeded when cl-meter, the JVM or the container\'s OOM killer stops the program', async () => {
    fakeDocker((cmd) => meterReport(cmd, { test: () => ({ mle: true, signal: 9, peakKb: 270000 }) }));
    await expect(run(input)).resolves.toMatchObject({ status: 'memory_limit_exceeded', error: 'Memory limit exceeded on test case 1 (limit 256 MB)' });

    fakeDocker((cmd) => meterReport(cmd, { test: () => ({ exit: 1, stderr: 'Exception in thread "main" java.lang.OutOfMemoryError: Java heap space' }) }));
    await expect(run(input)).resolves.toMatchObject({ status: 'memory_limit_exceeded' });

    fakeDocker((cmd) => meterReport(cmd, { test: () => ({ signal: 9, peakKb: 250000 }) }));
    await expect(run(input)).resolves.toMatchObject({ status: 'memory_limit_exceeded' });

    // A SIGKILL far below the memory limit is not a memory problem
    fakeDocker((cmd) => meterReport(cmd, { test: () => ({ signal: 9, peakKb: 3000 }) }));
    await expect(run(input)).resolves.toMatchObject({ status: 'runtime_error', error: 'Program was killed by SIGKILL' });
  });

  it('returns runtime_error when the program kills cl-meter before it reports', async () => {
    fakeDocker(() => ({ stdout: '{"version":1,"compile":{"ran":true,"ok":true},"tests":[{"exit":0' }));

    await expect(run(input)).resolves.toMatchObject({ status: 'runtime_error', error: 'The program stopped the judge before it finished' });
  });

  it('throws when Docker cannot start the sandbox, so the worker reports an error', async () => {
    fakeDocker(() => ({ error: dockerExit(125, 'Unable to find image') }));

    await expect(run(input)).rejects.toThrow('Sandbox failed to start: ');
  });

  it('removes the job directory afterwards, on success, on failure and when Docker fails', async () => {
    fakeDocker((cmd) => meterReport(cmd));
    await run(input);
    expect(leftoverJobDirs()).toEqual([]);

    fakeDocker((cmd) => meterReport(cmd, { compile: { ok: false, log: compilerError } }));
    await run(input);
    expect(leftoverJobDirs()).toEqual([]);

    fakeDocker(() => ({ error: dockerExit(125, 'no such image') }));
    await expect(run(input)).rejects.toThrow();
    expect(leftoverJobDirs()).toEqual([]);
  });

  it('throws when there are no test cases', async () => {
    await expect(run({ ...input, testCases: [] })).rejects.toThrow('No test cases provided');
  });

  it('runs the container inside the sandbox limits with a read-only job folder', async () => {
    fakeDocker((cmd) => meterReport(cmd));

    await run(input);

    const [[cmd]] = exec.mock.calls;
    expect(cmd).toContain(image);
    expect(cmd).toContain('--network none');
    expect(cmd).toContain('--read-only');
    expect(cmd).toContain('--cap-drop ALL');
    expect(cmd).toContain('--security-opt no-new-privileges');
    expect(cmd).toContain('--user nobody');
    expect(cmd).toMatch(/--memory="\d+m"/);
    expect(cmd).toMatch(/--pids-limit \d+/);
    expect(cmd).toMatch(/:\/app:ro"/);
    // Compiled programs run from /tmp, so the tmpfs must allow exec
    expect(cmd.match(/--tmpfs (\S+)/)[1].split(':')[1].split(',')).toContain('exec');
    expect(cmd.trim()).toMatch(/cl-meter \/app\/job\.conf$/);
  });
});

describe('runPython', () => {
  const input = { userCode: 'print(sum(map(int, input().split())))', testCases };

  it('returns accepted when every test case matches', async () => {
    fakeDocker((_cmd, stdin) => ({ stdout: addNumbers(stdin) }));

    const result = await runPython(input);

    expect(result).toMatchObject({ status: 'accepted', error: null });
    expect(exec).toHaveBeenCalledTimes(testCases.length);
  });

  it('stops at the first wrong answer', async () => {
    fakeDocker((_cmd, stdin) => ({ stdout: stdin === '5 5' ? '99' : addNumbers(stdin) }));

    const result = await runPython(input);

    expect(result).toMatchObject({
      status: 'wrong_answer',
      output: '99',
      failedTestCase: testCases[1],
      error: 'Expected: 10, Got: 99',
    });
    expect(exec).toHaveBeenCalledTimes(2);
  });

  it('returns runtime_error with the traceback', async () => {
    const traceback = 'Traceback (most recent call last):\nZeroDivisionError: division by zero';
    fakeDocker((cmd) => ({ error: commandFailed(cmd, traceback) }));

    const result = await runPython(input);

    expect(result.status).toBe('runtime_error');
    expect(result.error).toBe(traceback);
  });

  it('treats anything written to stderr as a runtime error', async () => {
    fakeDocker(() => ({ stdout: '3', stderr: 'warning: something' }));

    await expect(runPython(input)).resolves.toMatchObject({ status: 'runtime_error', error: 'warning: something' });
  });

  it('runs the user code through the resource-limit wrapper in a locked-down container', async () => {
    let wrapper;
    fakeDocker((cmd, stdin) => {
      const jobDir = cmd.match(/-v "([^"]+):\/app:ro"/)[1];
      wrapper = fs.readFileSync(path.join(jobDir, 'runner.py'), 'utf8');
      expect(fs.readFileSync(path.join(jobDir, 'main.py'), 'utf8')).toBe(input.userCode);
      return { stdout: addNumbers(stdin) };
    });

    await runPython(input);

    expect(wrapper).toContain('RLIMIT_CPU');
    expect(wrapper).toContain('RLIMIT_AS');
    const [cmd] = exec.mock.calls[0];
    expect(cmd).toContain('python:3.12-alpine');
    expect(cmd).toContain('--network none');
    expect(cmd).toContain('noexec');
    expect(leftoverJobDirs()).toEqual([]);
  });
});

describe('CODE_TMP_DIR', () => {
  afterEach(() => {
    delete process.env.CODE_TMP_DIR;
  });

  it.each([
    ['runCpp', runCpp],
    ['runJava', runJava],
    ['runPython', runPython],
  ])('%s writes job folders under CODE_TMP_DIR and mounts that path', async (_name, run) => {
    process.env.CODE_TMP_DIR = path.join(workRoot, 'shared', 'jobs');
    fakeDocker(anyRunner);

    await run({ userCode: 'x', driverCode: 'y', testCases });

    for (const [cmd] of exec.mock.calls) {
      expect(cmd).toContain(`-v "${process.env.CODE_TMP_DIR}/`);
    }
    expect(fs.readdirSync(process.env.CODE_TMP_DIR)).toEqual([]);
  });
});

describe('sandbox image overrides', () => {
  afterEach(() => {
    delete process.env.SANDBOX_IMAGE_CPP;
    delete process.env.SANDBOX_IMAGE_JAVA;
    delete process.env.SANDBOX_IMAGE_PYTHON;
  });

  it.each([
    ['runCpp', 'SANDBOX_IMAGE_CPP', runCpp],
    ['runJava', 'SANDBOX_IMAGE_JAVA', runJava],
    ['runPython', 'SANDBOX_IMAGE_PYTHON', runPython],
  ])('%s runs every container from %s when it is set', async (_name, envVar, run) => {
    process.env[envVar] = 'ghcr.io/example/sandbox:abc123';
    fakeDocker(anyRunner);

    await run({ userCode: 'x', driverCode: 'y', testCases });

    for (const [cmd] of exec.mock.calls) {
      expect(cmd).toMatch(/\sghcr\.io\/example\/sandbox:abc123\s/);
    }
  });
});

describe('runJavaScript', () => {
  // Known bug: docker/runJavaScript.js is empty, so the workers'
  // `runJavaScript(payload)` throws "runJavaScript is not a function" and every
  // JavaScript run/submission fails. Flip to a normal `it` once it's implemented.
  it.failing('exports a runner function', () => {
    expect(typeof require('../../docker/runJavaScript')).toBe('function');
  });
});
