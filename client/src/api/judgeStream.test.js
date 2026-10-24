import { afterEach, describe, expect, it, vi } from 'vitest';
import { subscribeToJudge } from './judgeStream';

class FakeSocket {
  static last;
  constructor() { FakeSocket.last = this; this.send = vi.fn(); this.close = vi.fn(() => this.onclose?.()); }
  message(data, jobId = '4') { this.onmessage({ data: JSON.stringify({ jobId, data }) }); }
}
const setup = () => {
  const onVerdict = vi.fn(), onAnalysis = vi.fn(), onError = vi.fn();
  const stop = subscribeToJudge({ type: 'RUN', jobId: '4', onVerdict, onAnalysis, onError, Socket: FakeSocket });
  return { socket: FakeSocket.last, onVerdict, onAnalysis, onError, stop };
};
afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); });

describe('judge event stream', () => {
  it('keeps the socket open after a failing verdict while analysis is pending', () => {
    const t = setup();t.socket.onopen();
    expect(JSON.parse(t.socket.send.mock.calls[0][0])).toEqual({ type: 'RUN', jobId: '4' });
    t.socket.message({ status: 'wrong_answer', analysisPending: true });
    expect(t.onVerdict).toHaveBeenCalledWith({ status: 'wrong_answer', analysisPending: true });
    expect(t.socket.close).not.toHaveBeenCalled();
    t.socket.message({ type: 'ANALYSIS', status: 'found', input: '[1]' });
    expect(t.onAnalysis).toHaveBeenCalledWith(expect.objectContaining({ status: 'found' }));
    expect(t.onVerdict).toHaveBeenCalledTimes(1);
    expect(t.socket.close).toHaveBeenCalledTimes(1);
  });
  it('handles analysis arriving before the cached verdict', () => {
    const t = setup();
    t.socket.message({ type: 'ANALYSIS', status: 'not_found' });
    expect(t.onAnalysis).not.toHaveBeenCalled();
    t.socket.message({ status: 'wrong_answer', analysisPending: true });
    expect(t.onVerdict).toHaveBeenCalledTimes(1);
    expect(t.onAnalysis).toHaveBeenCalledWith(expect.objectContaining({ status: 'not_found' }));
  });
  it('uses the complete cached verdict when analysis already finished', () => {
    const t = setup(), counterexample = { status: 'found', input: '1' };
    t.socket.message({ status: 'wrong_answer', analysisPending: false, counterexample });
    expect(t.onAnalysis).toHaveBeenCalledWith(counterexample);
    expect(t.socket.close).toHaveBeenCalled();
  });
  it('closes immediately without pending analysis and ignores unrelated jobs', () => {
    const t = setup();t.socket.message({ status: 'accepted' }, 'other');
    expect(t.onVerdict).not.toHaveBeenCalled();
    t.socket.message({ status: 'accepted' });
    expect(t.socket.close).toHaveBeenCalledTimes(1);
    expect(t.onError).not.toHaveBeenCalled();
  });
  it('preserves a verdict when analysis times out', () => {
    vi.useFakeTimers();
    const t = setup();t.socket.message({ status: 'runtime_error', analysisPending: true });
    vi.advanceTimersByTime(90000);
    expect(t.onAnalysis).toHaveBeenCalledWith(expect.objectContaining({ status: 'error' }));
    expect(t.onError).not.toHaveBeenCalled();
    expect(t.onVerdict).toHaveBeenCalledTimes(1);
  });
  it('waits for COMPLEXITY after an Accepted verdict that says it is coming', () => {
    const onComplexity = vi.fn();
    const stop = subscribeToJudge({ type: 'SUBMIT', jobId: '4', onVerdict: vi.fn(), onAnalysis: vi.fn(), onComplexity, onError: vi.fn(), Socket: FakeSocket });
    const socket = FakeSocket.last;
    socket.message({ status: 'accepted', complexityPending: true });
    expect(socket.close).not.toHaveBeenCalled();
    socket.message({ type: 'COMPLEXITY', status: 'done', label: 'O(n)' });
    expect(onComplexity).toHaveBeenCalledWith(expect.objectContaining({ label: 'O(n)' }));
    expect(socket.close).toHaveBeenCalledTimes(1);
    stop();
  });
  it('uses a complexity result already held by a replayed verdict', () => {
    const onComplexity = vi.fn();
    subscribeToJudge({ type: 'SUBMIT', jobId: '4', onVerdict: vi.fn(), onAnalysis: vi.fn(), onComplexity, onError: vi.fn(), Socket: FakeSocket });
    FakeSocket.last.message({ status: 'accepted', complexityPending: false, complexity: { status: 'done' } });
    expect(onComplexity).toHaveBeenCalledWith({ status: 'done' });
    expect(FakeSocket.last.close).toHaveBeenCalled();
  });
  it('says the result will come later when complexity analysis takes too long', () => {
    vi.useFakeTimers();
    const onComplexity = vi.fn(), onError = vi.fn();
    subscribeToJudge({ type: 'SUBMIT', jobId: '4', onVerdict: vi.fn(), onAnalysis: vi.fn(), onComplexity, onError, Socket: FakeSocket });
    FakeSocket.last.message({ status: 'accepted', complexityPending: true });
    vi.advanceTimersByTime(119999);
    expect(onComplexity).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(onComplexity).toHaveBeenCalledWith(expect.objectContaining({ status: 'later' }));
    expect(onError).not.toHaveBeenCalled();
  });
  it('does not deliver events after cancellation', () => {
    const t = setup();t.stop();t.socket.message({ status: 'wrong_answer' });
    expect(t.onVerdict).not.toHaveBeenCalled();
    expect(t.onError).not.toHaveBeenCalled();
  });
});

