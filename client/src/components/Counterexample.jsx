const LABELS = { wrong_answer: 'Wrong Answer', runtime_error: 'Runtime Error', time_limit_exceeded: 'Time Limit Exceeded', memory_limit_exceeded: 'Memory Limit Exceeded' };

export default function Counterexample({ analysis, pending = false }) {
  if (pending && !analysis) return <div className="ps-result-sub" role="status">Looking for a smaller failing input…</div>;
  if (!analysis) return null;
  if (analysis.status !== 'found') return (
    <div className="ps-result-sub" role="status">
      {analysis.status === 'not_found' ? 'No smaller failure was found in this bounded search.' : analysis.reason || 'Analysis is unavailable.'}
    </div>
  );
  return (
    <section className="ps-case" aria-label="Smaller failing input">
      <div className="ps-case-title">Smaller failing input</div>
      <div className="ps-result-sub">{LABELS[analysis.failureStatus] || 'Failure'} reproduced twice. This is not guaranteed to be the smallest possible case.</div>
      <div className="ps-case-row"><span>Input</span><pre>{analysis.input}</pre></div>
      <div className="ps-case-row"><span>Expected</span><pre>{analysis.expected}</pre></div>
      <div className="ps-case-row"><span>Your output</span><pre>{analysis.output || 'No output'}</pre></div>
      {analysis.outputTruncated && <div className="ps-result-sub">Output shortened for display.</div>}
    </section>
  );
}
