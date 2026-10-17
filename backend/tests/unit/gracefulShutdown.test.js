const gracefulShutdown = require('../../utils/gracefulShutdown');

const registered = [];
const setup = (cleanup, options = {}) => {
  const exit = jest.fn();
  const handler = gracefulShutdown('test', cleanup, { exit, ...options });
  registered.push(handler);
  return { handler, exit };
};

afterEach(() => {
  for (const handler of registered.splice(0)) {
    process.removeListener('SIGTERM', handler);
    process.removeListener('SIGINT', handler);
  }
  jest.useRealTimers();
});

describe('gracefulShutdown', () => {
  it('registers for SIGTERM and SIGINT', () => {
    const { handler } = setup(async () => {});

    expect(process.listeners('SIGTERM')).toContain(handler);
    expect(process.listeners('SIGINT')).toContain(handler);
  });

  it('runs cleanup then exits 0', async () => {
    const cleanup = jest.fn(async () => {});
    const { handler, exit } = setup(cleanup);

    await handler('SIGTERM');

    expect(cleanup).toHaveBeenCalledTimes(1);
    expect(exit).toHaveBeenCalledWith(0);
  });

  it('exits 1 when cleanup throws', async () => {
    const { handler, exit } = setup(async () => {
      throw new Error('redis already closed');
    });

    await handler('SIGTERM');

    expect(exit).toHaveBeenCalledWith(1);
  });

  it('only shuts down once if signalled twice', async () => {
    const cleanup = jest.fn(async () => {});
    const { handler, exit } = setup(cleanup);

    await Promise.all([handler('SIGTERM'), handler('SIGINT')]);

    expect(cleanup).toHaveBeenCalledTimes(1);
    expect(exit).toHaveBeenCalledTimes(1);
  });

  it('forces exit 1 when cleanup hangs past the timeout', async () => {
    jest.useFakeTimers();
    const { handler, exit } = setup(() => new Promise(() => {}), { timeoutMs: 500 });

    handler('SIGTERM');
    jest.advanceTimersByTime(499);
    expect(exit).not.toHaveBeenCalled();

    jest.advanceTimersByTime(1);
    expect(exit).toHaveBeenCalledWith(1);
  });
});
