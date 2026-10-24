import { useRef, useState } from "react";
import "./ResourceTimeline.css";
import "./ComplexityFit.css";

/* How an Accepted solution's running time grew with input size, and the
 * complexity class that fits it best (see backend problemkit/complexity.js). */

const formatMs = (v) => (v >= 1000 ? `${(v / 1000).toFixed(2)} s` : v >= 10 ? `${Math.round(v)} ms` : v >= 0.1 ? `${v.toFixed(2)} ms` : `${Math.round(v * 1000)} µs`);
const formatSize = (v) => (v >= 1e6 ? `${+(v / 1e6).toFixed(1)}M` : v >= 1e4 ? `${+(v / 1e3).toFixed(1)}k` : Math.round(v).toLocaleString());

/* Rounds up to 1, 2 or 5 × 10ⁿ so the axis tops out at a clean number */
const niceCeil = (v) => {
  if (!(v > 0)) return 1;
  const p = 10 ** Math.floor(Math.log10(v));
  return [1, 2, 5, 10].map((m) => m * p).find((n) => n >= v);
};

const VERDICTS = {
  matches: (e) => `Matches the expected ${e}.`,
  close: (e) => `Hard to tell apart from the expected ${e} at these sizes.`,
  slower: (e) => `Grows faster than the expected ${e}.`,
  faster: (e) => `Grows more slowly than the expected ${e}.`,
};

const Chart = ({ points, curves, variable, label, expectedLabel }) => {
  const [hover, setHover] = useState(null);
  const plotRef = useRef(null);
  const xMax = niceCeil(Math.max(...points.map((p) => p.x)));
  const yMax = niceCeil(Math.max(...points.map((p) => p.ms), ...(curves.best || []).map(([, y]) => y)));
  const px = (x) => (x / xMax) * 100;
  const py = (y) => 100 - (Math.min(y, yMax) / yMax) * 100;
  const path = (curve) => curve.map(([x, y], i) => `${i ? "L" : "M"}${px(x)},${py(Math.max(0, y))}`).join(" ");

  const onPointerMove = (e) => {
    const { left, width } = plotRef.current.getBoundingClientRect();
    const x = ((e.clientX - left) / width) * 100;
    let best = 0;
    points.forEach((p, i) => { if (Math.abs(px(p.x) - x) < Math.abs(px(points[best].x) - x)) best = i; });
    setHover(best);
  };
  const onKeyDown = (e) => {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    e.preventDefault();
    const step = e.key === "ArrowRight" ? 1 : -1;
    setHover((h) => Math.min(points.length - 1, Math.max(0, (h ?? (step > 0 ? -1 : points.length)) + step)));
  };
  const p = hover != null ? points[hover] : null;

  return (
    <div className="rt-charts" tabIndex={0} role="img"
      aria-label={`Running time at ${points.length} input sizes, best fit ${label}; use the arrow keys to read each size`}
      onPointerMove={onPointerMove} onPointerLeave={() => setHover(null)}
      onKeyDown={onKeyDown} onBlur={() => setHover(null)}>
      <div className="cx-legend">
        <span><i className="cx-key cx-key-best" />Your times · fit {label}</span>
        {curves.expected && <span><i className="cx-key cx-key-expected" />{expectedLabel} shape</span>}
      </div>
      <div className="rt-readout" aria-live="polite">
        {p ? <>
          <span>{variable} = <b>{formatSize(p.x)}</b></span>
          <span>Time <b>{formatMs(p.ms)}</b></span>
        </> : <span>Hover the chart to read each size</span>}
      </div>
      <div className="rt-track-body">
        <div className="rt-yaxis cx-yaxis" aria-hidden="true">
          <span>{formatMs(yMax)}</span>
          <span>{formatMs(yMax / 2)}</span>
          <span>0</span>
        </div>
        <div className="rt-plot cx-plot" ref={plotRef}>
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
            {[0, 50, 100].map((y) => (
              <line key={y} x1="0" x2="100" y1={y} y2={y} className="rt-grid" vectorEffect="non-scaling-stroke" />
            ))}
            {curves.expected && <path d={path(curves.expected)} className="cx-expected" vectorEffect="non-scaling-stroke" />}
            {curves.best && <path d={path(curves.best)} className="rt-line" vectorEffect="non-scaling-stroke" />}
          </svg>
          {points.map((q, i) => (
            <span key={q.n} className={`rt-dot cx-dot ${i === hover ? "cx-dot-hover" : ""}`}
              style={{ left: `${px(q.x)}%`, top: `${py(q.ms)}%` }} />
          ))}
          {p && <span className="rt-crosshair" style={{ left: `${px(p.x)}%` }} />}
        </div>
      </div>
      <div className="rt-xaxis cx-xaxis" aria-hidden="true">
        <span>0</span>
        <span>{formatSize(xMax / 2)}</span>
        <span>{variable} = {formatSize(xMax)}</span>
      </div>
    </div>
  );
};

const ComplexityFit = ({ analysis, pending = false }) => {
  if (pending && !analysis) return <div className="ps-result-sub" role="status">Measuring how your solution's time grows with input size…</div>;
  if (!analysis || analysis.status === "skipped") return null;
  if (analysis.status !== "done") {
    return <div className="ps-result-sub" role="status">{analysis.reason || "Complexity analysis is unavailable."}</div>;
  }
  const { label, expectedLabel, verdict, points = [], curves = {}, variable = "n" } = analysis;
  return (
    <section className="rt" aria-label="Time complexity">
      <div className="rt-head">
        <div>
          <div className="rt-title">Time complexity</div>
          <div className="rt-sub">{VERDICTS[verdict]?.(expectedLabel)}</div>
        </div>
        <dl className="rt-stats">
          <div><dt>Your solution</dt><dd>{label}</dd></div>
          <div><dt>Expected</dt><dd>{expectedLabel}</dd></div>
        </dl>
      </div>
      {points.length >= 2 && <Chart points={points} curves={curves} variable={variable} label={label} expectedLabel={expectedLabel} />}
      <details className="rt-table">
        <summary>Show as table</summary>
        <table>
          <thead><tr><th>{variable}</th><th>Time</th></tr></thead>
          <tbody>
            {points.map((q) => <tr key={q.n}><td>{q.x.toLocaleString()}</td><td>{formatMs(q.ms)}</td></tr>)}
          </tbody>
        </table>
      </details>
      <p className="rt-note">
        The fastest of 3 runs at each size, timing only your function. An estimate from a handful of sizes, not a proof.
      </p>
    </section>
  );
};

export default ComplexityFit;
