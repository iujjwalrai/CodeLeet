const DEFAULT_TIMEOUT_MS = 10000;

/**
 * Runs `cleanup` once on SIGTERM/SIGINT, then exits. If cleanup hangs past
 * the timeout the process exits with code 1 so orchestrators aren't blocked.
 * Returns the handler so tests can trigger it without sending a signal.
 */
function gracefulShutdown(name, cleanup, { timeoutMs, exit = process.exit } = {}) {
  const limit = Number(timeoutMs || process.env.SHUTDOWN_TIMEOUT_MS || DEFAULT_TIMEOUT_MS);
  let shuttingDown = false;

  const handler = async (signal) => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`${name}: received ${signal}, shutting down`);

    const timer = setTimeout(() => {
      console.error(`${name}: shutdown timed out after ${limit}ms, forcing exit`);
      exit(1);
    }, limit);
    timer.unref();

    try {
      await cleanup();
      clearTimeout(timer);
      console.log(`${name}: shutdown complete`);
      exit(0);
    } catch (err) {
      clearTimeout(timer);
      console.error(`${name}: error during shutdown:`, err);
      exit(1);
    }
  };

  process.once('SIGTERM', handler);
  process.once('SIGINT', handler);
  return handler;
}

module.exports = gracefulShutdown;
