import { useRef, useState } from "react";
import "./ResourceTimeline.css";

/* What the judge measured during a run: memory and CPU over time for the
 * heaviest test, plus time and peak memory of every test (see judge.js). */

const formatKb = (kb) => (kb >= 1024 ? `${(kb / 1024).toFixed(1)} MB` : `${Math.round(kb)} KB`);
const formatMs = (v) => (v >= 1000 ? `${(v / 1000).toFixed(2)} s` : v < 10 ? `${v.toFixed(1)} ms` : `${Math.round(v)} ms`);
const formatPct = (v) => `${Math.round(v)}%`;
/* Axis ticks: "100 MB", "2.5 MB" */
const formatAxisKb = (kb) => (kb >= 1024 ? `${+(kb / 1024).toFixed(1)} MB` : `${Math.round(kb)} KB`);

/* Rounds up to 1, 2 or 5 × 10ⁿ so the axis tops out at a clean number */
const niceCeil = (v) => {
  if (!(v > 0)) return 1;
  const p = 10 ** Math.floor(Math.log10(v));
  return [1, 2, 5, 10].map((m) => m * p).find((n) => n >= v);
};

/* Window CPU use is measured over; the first 50 ms are sampled every 1 ms,
   which is too short to say much about how busy the program was */
const CPU_WINDOW_MS = 5;

/* CPU use over the last few ms before each sample, as % of one core */
const cpuPercent = (timeline) =>
  timeline.map((s, i) => {
    let prev = { t: 0, cpuMs: 0 };
    for (let j = i - 1; j >= 0; j--) {
      if (s.t - timeline[j].t >= CPU_WINDOW_MS) { prev = timeline[j]; break; }
    }
    const dt = s.t - prev.t;
    return dt > 0 ? Math.min(100, Math.max(0, ((s.cpuMs - prev.cpuMs) / dt) * 100)) : 0;
  });

/* One single-series plot; x positions are shared so the crosshair lines up */
const Track = ({ title, values, xs, max, format, hover }) => {
  const ys = values.map((v) => 100 - (v / max) * 100);
  const line = xs.map((x, i) => `${i ? "L" : "M"}${x},${ys[i]}`).join(" ");
  const area = `${line} L${xs.at(-1)},100 L${xs[0]},100 Z`;
  return (
    <div className="rt-track">
      <div className="rt-track-title">{title}</div>
      <div className="rt-track-body">
        <div className="rt-yaxis" aria-hidden="true">
          <span>{format(max)}</span>
          <span>{format(max / 2)}</span>
          <span>0</span>
        </div>
        <div className="rt-plot">
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
            {[0, 50, 100].map((y) => (
              <line key={y} x1="0" x2="100" y1={y} y2={y} className="rt-grid" vectorEffect="non-scaling-stroke" />
            ))}
            <path d={area} className="rt-area" />
            <path d={line} className="rt-line" vectorEffect="non-scaling-stroke" />
          </svg>
          {hover != null && <>
            <span className="rt-crosshair" style={{ left: `${xs[hover]}%` }} />
            <span className="rt-dot" style={{ left: `${xs[hover]}%`, top: `${ys[hover]}%` }} />
          </>}
        </div>
      </div>
    </div>
  );
};

const Timeline = ({ timeline }) => {
  const [hover, setHover] = useState(null);
  const plotRef = useRef(null);

  const tMax = Math.max(timeline.at(-1).t, 0.001);
  const xs = timeline.map((s) => (s.t / tMax) * 100);
  const rss = timeline.map((s) => s.rssKb);
  const cpu = cpuPercent(timeline);
  const memMax = niceCeil(Math.max(...rss) / 1024) * 1024;

  // Snap the pointer to the nearest sample
  const onPointerMove = (e) => {
    const plot = plotRef.current?.querySelector(".rt-plot");
    if (!plot) return;
    const { left, width } = plot.getBoundingClientRect();
    const x = ((e.clientX - left) / width) * 100;
    let best = 0;
    xs.forEach((v, i) => { if (Math.abs(v - x) < Math.abs(xs[best] - x)) best = i; });
    setHover(best);
  };
  const onKeyDown = (e) => {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    e.preventDefault();
    const step = e.key === "ArrowRight" ? 1 : -1;
    setHover((h) => Math.min(timeline.length - 1, Math.max(0, (h ?? (step > 0 ? -1 : timeline.length)) + step)));
  };

  const s = hover != null ? timeline[hover] : null;

  return (
    <div className="rt-charts" ref={plotRef} tabIndex={0}
      role="img"
      aria-label={`Memory rose to ${formatKb(Math.max(...rss))} over ${formatMs(tMax)}; use the arrow keys to read each sample`}
      onPointerMove={onPointerMove} onPointerLeave={() => setHover(null)}
      onKeyDown={onKeyDown} onBlur={() => setHover(null)}>
      {/* A fixed readout rather than a floating tooltip, which would cover
          most of the chart in a narrow pane */}
      <div className="rt-readout" aria-live="polite">
        {s ? <>
          <b>{formatMs(s.t)}</b>
          <span>Memory <b>{formatKb(s.rssKb)}</b></span>
          <span>CPU <b>{formatPct(cpu[hover])}</b></span>
        </> : <span>Hover the chart to read a sample</span>}
      </div>
      <Track title="Memory" values={rss} xs={xs} max={memMax} format={formatAxisKb} hover={hover} />
      <Track title="CPU (% of one core)" values={cpu} xs={xs} max={100} format={formatPct} hover={hover} />
      <div className="rt-xaxis" aria-hidden="true">
        <span>0</span>
        <span>{formatMs(tMax / 2)}</span>
        <span>{formatMs(tMax)}</span>
      </div>
    </div>
  );
};

/* Time and peak memory of each test, heaviest highlighted */
const TestBars = ({ tests, heaviest }) => {
  const [hover, setHover] = useState(null);
  const rows = [
    { label: "Time", key: "wallMs", format: formatMs },
    { label: "Memory", key: "peakKb", format: formatKb },
  ];
  const shown = hover ?? heaviest;
  const t = tests[shown];
  return (
    <div className="rt-tests" onPointerLeave={() => setHover(null)}>
      <div className="rt-tests-head">
        <span className="rt-track-title">Per test</span>
        {t && (
          <span className="rt-tests-readout">
            Test {shown + 1}{hover == null && " (heaviest)"} · {formatMs(t.wallMs)} · {formatKb(t.peakKb)}
          </span>
        )}
      </div>
      {rows.map(({ label, key }) => {
        const max = Math.max(...tests.map((x) => x[key]), 0.001);
        return (
          <div key={key} className="rt-bars-row">
            <span className="rt-bars-label">{label}</span>
            <div className="rt-bars">
              {tests.map((x, i) => (
                <span key={i}
                  className={`rt-bar ${i === heaviest ? "rt-bar-heavy" : ""} ${i === hover ? "rt-bar-hover" : ""}`}
                  onPointerEnter={() => setHover(i)}>
                  <span style={{ height: `${Math.max(4, (x[key] / max) * 100)}%` }} />
                </span>
              ))}
            </div>
          </div>
        );
      })}
      <details className="rt-table">
        <summary>Show as table</summary>
        <table>
          <thead><tr><th>Test</th>{rows.map((r) => <th key={r.key}>{r.label}</th>)}</tr></thead>
          <tbody>
            {tests.map((x, i) => (
              <tr key={i}><td>{i + 1}</td>{rows.map((r) => <td key={r.key}>{r.format(x[r.key])}</td>)}</tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  );
};

const ResourceTimeline = ({ resources }) => {
  if (!resources) return null;
  const { testIndex, peakKb, cpuMs, wallMs, timeline = [], tests = [] } = resources;
  return (
    <section className="rt">
      <div className="rt-head">
        <div>
          <div className="rt-title">Resources</div>
          <div className="rt-sub">Test {testIndex + 1}, the one that used the most CPU</div>
        </div>
        <dl className="rt-stats">
          <div><dt>Peak memory</dt><dd>{formatKb(peakKb)}</dd></div>
          <div><dt>CPU time</dt><dd>{formatMs(cpuMs)}</dd></div>
          <div><dt>Wall time</dt><dd>{formatMs(wallMs)}</dd></div>
        </dl>
      </div>
      {timeline.length >= 3
        ? <Timeline timeline={timeline} />
        : <p className="rt-note">Finished in {formatMs(wallMs)}, too short to chart.</p>}
      {tests.length > 1 && <TestBars tests={tests} heaviest={testIndex} />}
    </section>
  );
};

export default ResourceTimeline;
