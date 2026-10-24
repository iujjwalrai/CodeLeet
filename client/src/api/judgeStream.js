import { wsUrl } from './urls';

const FINAL = new Set(['accepted', 'wrong_answer', 'compilation_error', 'runtime_error', 'time_limit_exceeded', 'memory_limit_exceeded', 'error']);

// A final verdict may be followed by ANALYSIS. Never replace the verdict
// with an analysis status, and tolerate replay/live-message races.
export function subscribeToJudge({ type, jobId, onVerdict, onAnalysis, onError, Socket = WebSocket }) {
  const ws = new Socket(wsUrl());
  let stopped = false, finalSeen = false, pending = false, buffered = null, timer;
  const stop = () => {
    if (stopped) return;
    stopped = true;
    clearTimeout(timer);
    ws.close();
  };
  const interrupted = () => {
    if (stopped) return;
    if (finalSeen) onAnalysis({ status: 'error', reason: 'Analysis was interrupted. The verdict is unchanged.' });
    else onError();
    stop();
  };
  const deliverAnalysis = data => {
    if (!finalSeen) { buffered = data; return; }
    onAnalysis(data);
    stop();
  };
  ws.onopen = () => { if (!stopped) ws.send(JSON.stringify({ type, jobId })); };
  ws.onmessage = event => {
    if (stopped) return;
    let message;
    try { message = JSON.parse(event.data); } catch { return; }
    if (String(message.jobId) !== String(jobId) || !message.data) return;
    const data = message.data;
    if (data.type === 'ANALYSIS') { deliverAnalysis(data); return; }
    if (finalSeen) return; // Ignore a stale replayed Running/verdict message.
    onVerdict(data);
    if (!FINAL.has(data.status)) return;
    finalSeen = true;
    pending = !!data.analysisPending;
    if (data.counterexample) deliverAnalysis(data.counterexample);
    else if (buffered) deliverAnalysis(buffered);
    else if (!pending) stop();
    else timer = setTimeout(interrupted, 90000);
  };
  ws.onerror = interrupted;
  ws.onclose = interrupted;
  return stop;
}
