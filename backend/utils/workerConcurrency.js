/*
 * How many jobs one judging worker container runs at once, from
 * WORKER_CONCURRENCY (default 1). Every job starts a sandbox limited to one
 * CPU, so replicas × concurrency should not exceed the host's cores, or
 * correct solutions start hitting the time limit.
 */
function workerConcurrency(env = process.env) {
  const n = Number(env.WORKER_CONCURRENCY);
  return Number.isInteger(n) && n >= 1 ? n : 1;
}

module.exports = workerConcurrency;
