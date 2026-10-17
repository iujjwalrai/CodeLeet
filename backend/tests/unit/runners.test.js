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

describe.each([
  ['runCpp', runCpp, 'g++', 'codeleet-cpp', 'Solution.cpp:4:3: error: expected \';\''],
  ['runJava', runJava, 'javac', 'codeleet-java', 'Solution.java:4: error: \';\' expected'],
])('%s', (_name, run, compiler, image, compilerError) => {
  const isCompile = (cmd) => cmd.includes(compiler);
  const input = { userCode: 'user code', driverCode: 'driver code', testCases };

  it('returns accepted when every test case matches', async () => {
    fakeDocker((cmd, stdin) => (isCompile(cmd) ? {} : { stdout: addNumbers(stdin) }));

    const result = await run(input);

    expect(result).toMatchObject({ status: 'accepted', passedCount: 3, totalCount: 3, error: null });
    expect(typeof result.time).toBe('number');
  });

  it('compiles once and runs one container per test case, passing input on stdin', async () => {
    const seenInputs = [];
    fakeDocker((cmd, stdin) => {
      if (isCompile(cmd)) return {};
      seenInputs.push(stdin);
      return { stdout: addNumbers(stdin) };
    });

    await run(input);

    expect(exec).toHaveBeenCalledTimes(1 + testCases.length);
    expect(seenInputs).toEqual(testCases.map((tc) => tc.input));
  });

  it('reports the first failing test case on wrong answer but keeps counting passes', async () => {
    fakeDocker((cmd, stdin) => {
      if (isCompile(cmd)) return {};
      return { stdout: stdin === '5 5' ? '11\n' : addNumbers(stdin) };
    });

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
    fakeDocker((cmd, stdin) => (isCompile(cmd) ? {} : { stdout: `  ${addNumbers(stdin)}\n\n` }));

    await expect(run(input)).resolves.toMatchObject({ status: 'accepted' });
  });

  it('returns compilation_error with the compiler output (without the docker command)', async () => {
    fakeDocker((cmd) => (isCompile(cmd) ? { error: commandFailed(cmd, compilerError) } : { stdout: '' }));

    const result = await run(input);

    expect(result.status).toBe('compilation_error');
    expect(result.error).toBe(compilerError);
    expect(exec).toHaveBeenCalledTimes(1);
  });

  it('returns runtime_error when the program crashes', async () => {
    fakeDocker((cmd) => (isCompile(cmd) ? {} : { error: commandFailed(cmd, 'Segmentation fault (core dumped)') }));

    const result = await run(input);

    expect(result.status).toBe('runtime_error');
    expect(result.error).toBe('Segmentation fault (core dumped)');
  });

  it('removes the job directory afterwards, on success and on failure', async () => {
    fakeDocker((cmd, stdin) => (isCompile(cmd) ? {} : { stdout: addNumbers(stdin) }));
    await run(input);
    expect(leftoverJobDirs()).toEqual([]);

    fakeDocker((cmd) => ({ error: commandFailed(cmd, compilerError) }));
    await run(input);
    expect(leftoverJobDirs()).toEqual([]);
  });

  it('throws when there are no test cases', async () => {
    await expect(run({ ...input, testCases: [] })).rejects.toThrow('No test cases provided');
  });

  it('runs every container inside the sandbox limits', async () => {
    fakeDocker((cmd, stdin) => (isCompile(cmd) ? {} : { stdout: addNumbers(stdin) }));

    await run(input);

    for (const [cmd] of exec.mock.calls) {
      expect(cmd).toContain(image);
      expect(cmd).toContain('--network none');
      expect(cmd).toContain('--read-only');
      expect(cmd).toContain('--cap-drop ALL');
      expect(cmd).toContain('--security-opt no-new-privileges');
      expect(cmd).toContain('--user nobody');
      expect(cmd).toMatch(/--memory="\d+m"/);
      expect(cmd).toMatch(/--pids-limit \d+/);
    }
    // Only the compile step may write to the job directory.
    const runCalls = exec.mock.calls.filter(([cmd]) => !isCompile(cmd));
    for (const [cmd] of runCalls) {
      expect(cmd).toMatch(/:\/app:ro"/);
    }
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

describe('runJavaScript', () => {
  // Known bug: docker/runJavaScript.js is empty, so the workers'
  // `runJavaScript(payload)` throws "runJavaScript is not a function" and every
  // JavaScript run/submission fails. Flip to a normal `it` once it's implemented.
  it.failing('exports a runner function', () => {
    expect(typeof require('../../docker/runJavaScript')).toBe('function');
  });
});
