import { wsUrl } from './urls';

const FINAL = new Set(['accepted', 'wrong_answer', 'compilation_error', 'runtime_error', 'time_limit_exceeded', 'memory_limit_exceeded', 'error']);

// Events that can follow a final verdict: the verdict says one is coming
// with `pending`, and a replayed verdict may already hold it as `cached`
const FOLLOW_UPS = {
  ANALYSIS: {
    pending: 'analysisPending', cached: 'counterexample', timeoutMs: 90000,
    interrupted: { status: 'error', reason: 'Analysis was interrupted. The verdict is unchanged.' },
  },
  COMPLEXITY: {
    pending: 'complexityPending', cached: 'complexity', timeoutMs: 120000,
    interrupted: { status: 'later', reason: 'Still measuring. The result will appear on this submission in your history.' },
  },
};

// Never replace the verdict with a follow-up's status, and tolerate
// replay/live-message races.
export function subscribeToJudge({ type, jobId, onVerdict, onAnalysis, onComplexity = () => {}, onError, Socket = WebSocket }) {
  const handlers = { ANALYSIS: onAnalysis, COMPLEXITY: onComplexity };
  const ws = new Socket(wsUrl());
  const waiting = new Set(), buffered = {};
  let stopped = false, finalSeen = false, timer;
  const stop = () => {
    if (stopped) return;
    stopped = true;
    clearTimeout(timer);
    ws.close();
  };
  const interrupted = () => {
    if (stopped) return;
    if (finalSeen) for (const kind of waiting) handlers[kind](FOLLOW_UPS[kind].interrupted);
    else onError();
    stop();
  };
  const deliver = (kind, data) => {
    if (!finalSeen) { buffered[kind] = data; return; }
    waiting.delete(kind);
    handlers[kind](data);
    if (!waiting.size) stop();
  };
  ws.onopen = () => { if (!stopped) ws.send(JSON.stringify({ type, jobId })); };
  ws.onmessage = event => {
    if (stopped) return;
    let message;
    try { message = JSON.parse(event.data); } catch { return; }
    if (String(message.jobId) !== String(jobId) || !message.data) return;
    const data = message.data;
    if (data.type in FOLLOW_UPS) { deliver(data.type, data); return; }
    if (finalSeen) return; // Ignore a stale replayed Running/verdict message.
    onVerdict(data);
    if (!FINAL.has(data.status)) return;
    finalSeen = true;
    const ready = [];
    for (const [kind, f] of Object.entries(FOLLOW_UPS)) {
      if (data[f.pending]) waiting.add(kind);
      const known = data[f.cached] ?? buffered[kind];
      if (known) ready.push([kind, known]);
    }
    for (const [kind, known] of ready) deliver(kind, known);
    if (stopped) return;
    if (!waiting.size) stop();
    else timer = setTimeout(interrupted, Math.max(...[...waiting].map(kind => FOLLOW_UPS[kind].timeoutMs)));
  };
  ws.onerror = interrupted;
  ws.onclose = interrupted;
  return stop;
}
