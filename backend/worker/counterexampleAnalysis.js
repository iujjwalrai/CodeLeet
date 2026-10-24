const { canAnalyze, findCounterexample } = require('../problemkit/counterexample');
const cache = require('../config/redis');
const pubsub = require('../config/redispubsub');

async function analyzeFailure({ jobId, channel, problem, code, language, result, save }) {
  let counterexample;
  try {
    counterexample = await findCounterexample({ problem, code, language, result });
  } catch {
    // Sandbox/compiler errors can include trusted source. Do not forward them.
    counterexample = { status: 'error', reason: 'The search could not be completed. The original verdict is unchanged.' };
  }
  if (save) {
    try { await save(counterexample); } catch {
      // A failed analysis write must not turn an already saved verdict into an
      // error or prevent the connected client from receiving its analysis.
      console.error('Unable to save counterexample analysis');
    }
  }
  const payload = JSON.stringify({ jobId, data: { type: 'ANALYSIS', ...counterexample } });
  // Keep the verdict cache intact; late subscribers replay verdict, then analysis.
  await cache.set(`job-cache:${channel}:analysis`, payload, 'EX', 60);
  const verdict = await cache.get(`job-cache:${channel}`);
  if (verdict) {
    const cached = JSON.parse(verdict);
    cached.data.analysisPending = false;
    cached.data.counterexample = counterexample;
    // Refresh after the analysis cache, so the verdict cannot expire first.
    await cache.set(`job-cache:${channel}`, JSON.stringify(cached), 'EX', 60);
  }
  await pubsub.publish(channel, payload);
  return counterexample;
}

module.exports = { canAnalyze, analyzeFailure };
