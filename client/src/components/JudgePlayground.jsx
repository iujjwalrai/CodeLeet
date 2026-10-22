import React, { useEffect, useRef, useState } from "react";
import { motion, useInView, AnimatePresence } from "framer-motion";
import { Play, RotateCcw, Check, X } from "lucide-react";

/* An animated replay of one submission going through the real stack.
   Nothing is sent to the server: the timeline below is scripted from
   what the API, queue, worker and WebSocket actually do. */

const TESTS = [["1 2", "3"], ["-4 9", "5"], ["0 0", "0"]];

const VARIANTS = {
  correct: { file: "Solution.java", op: "+", fn: (a, b) => a + b },
  buggy: { file: "Buggy.java", op: "-", fn: (a, b) => a - b },
};

const STAGES = [
  { name: "Editor", tech: "React · Monaco" },
  { name: "API", tech: "Express" },
  { name: "Queue", tech: "BullMQ · Redis" },
  { name: "Sandbox", tech: "Docker" },
  { name: "Verdict", tech: "WebSocket" },
];

/* Flat list of [stageIndex, logLine, tone] events for a variant */
const timeline = (key) => {
  const v = VARIANTS[key];
  const events = [
    [0, `captured ${v.file}`],
    [1, "POST /api/submissions → 202"],
    [1, "job 4f2a created"],
    [2, "job 4f2a waiting"],
    [2, "picked up by a worker"],
    [3, "docker run --network none --memory 256m"],
    [3, "compile · ok"],
  ];
  let passed = 0;
  for (const [i, [input, expected]] of TESTS.entries()) {
    const [a, b] = input.split(" ").map(Number);
    const got = String(v.fn(a, b));
    if (got === expected) {
      passed++;
      events.push([3, `test ${i + 1}: ${input} → ${got}`, "ok"]);
    } else {
      events.push([3, `test ${i + 1}: expected ${expected}, got ${got}`, "bad"]);
      break;
    }
  }
  const ok = passed === TESTS.length;
  events.push([4, ok ? `Accepted · ${passed}/${TESTS.length} · 42 ms` : `Wrong Answer · ${passed}/${TESTS.length}`, ok ? "ok" : "bad"]);
  return { events, ok };
};

const Code = ({ op }) => (
  <pre className="font-mono text-[13px] leading-6">
    {[
      [<><span className="text-[#c026d3] dark:text-[#e879f9]">class</span> Solution {"{"}</>],
      [<>  <span className="text-[#0891b2] dark:text-[#67e8f9]">int</span> add(<span className="text-[#0891b2] dark:text-[#67e8f9]">int</span> a, <span className="text-[#0891b2] dark:text-[#67e8f9]">int</span> b) {"{"}</>],
      [<>    <span className="text-[#c026d3] dark:text-[#e879f9]">return</span> a <motion.span key={op} initial={{ backgroundColor: "rgba(16,185,129,0.35)" }} animate={{ backgroundColor: "rgba(16,185,129,0)" }} transition={{ duration: 0.8 }} className="rounded px-0.5">{op}</motion.span> b;</>],
      [<>  {"}"}</>],
      [<>{"}"}</>],
    ].map(([line], i) => (
      <div key={i} className="flex">
        <span className="w-7 shrink-0 select-none text-faint">{i + 1}</span>
        <span className="whitespace-pre">{line}</span>
      </div>
    ))}
  </pre>
);

const JudgePlayground = () => {
  const [variant, setVariant] = useState("correct");
  const [shown, setShown] = useState(0);
  const [running, setRunning] = useState(false);
  const timers = useRef([]);
  const root = useRef(null);
  const inView = useInView(root, { once: true, amount: 0.4 });

  const { events, ok } = timeline(variant);
  const done = shown === events.length;
  const current = shown > 0 ? events[shown - 1][0] : -1;

  const clear = () => { timers.current.forEach(clearTimeout); timers.current = []; };

  const run = (key = variant) => {
    clear();
    setShown(0);
    setRunning(true);
    const list = timeline(key).events;
    let t = 250;
    list.forEach((ev, i) => {
      // a beat longer when moving to a new stage
      t += i > 0 && list[i - 1][0] !== ev[0] ? 650 : 320;
      timers.current.push(setTimeout(() => {
        setShown(i + 1);
        if (i === list.length - 1) setRunning(false);
      }, t));
    });
  };

  const pick = (key) => {
    if (key === variant) return;
    clear();
    setVariant(key);
    setShown(0);
    setRunning(false);
  };

  // Play once on its own the first time it scrolls into view
  useEffect(() => {
    if (!inView) return;
    const t = setTimeout(() => run("correct"), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inView]);

  useEffect(() => clear, []);

  return (
    <div ref={root} className="grid gap-6 lg:grid-cols-[1fr_1.1fr] lg:gap-10">
      {/* editor */}
      <div className="card flex flex-col self-start overflow-hidden shadow-pop">
        <div className="flex items-end gap-1 border-b border-line bg-subtle px-2 pt-2">
          {Object.entries(VARIANTS).map(([key, v]) => (
            <button key={key} onClick={() => pick(key)}
              className={`flex items-center gap-2 rounded-t-md border border-b-0 px-3 py-1.5 font-mono text-xs transition-colors ${
                variant === key ? "border-line bg-surface text-fg" : "border-transparent text-faint hover:text-dim"}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${key === "correct" ? "bg-ok" : "bg-bad"}`} />
              {v.file}
            </button>
          ))}
        </div>
        <div className="px-4 py-4 text-fg">
          <Code op={VARIANTS[variant].op} />
        </div>
        <div className="flex items-center justify-between gap-3 border-t border-line px-4 py-3">
          <span className="text-xs text-faint">Replay of a real run. No code is sent.</span>
          <button className="btn btn-primary btn-sm" onClick={() => run()} disabled={running}>
            {done ? <RotateCcw size={14} /> : <Play size={14} />}
            {running ? "Running…" : done ? "Run again" : "Run it"}
          </button>
        </div>
      </div>

      {/* pipeline rail */}
      <ol className="relative">
        {STAGES.map((s, i) => {
          const lines = events.filter(([st], j) => st === i && j < shown);
          const isDone = current > i || (done && current === i);
          const isActive = current === i && !done;
          const isVerdict = i === STAGES.length - 1;
          const tone = isVerdict && done ? (ok ? "ok" : "bad") : "accent";
          return (
            <li key={s.name} className="relative flex gap-4 pb-6 last:pb-0">
              {/* connector */}
              {i < STAGES.length - 1 && (
                <span className="absolute left-[11px] top-7 bottom-0 w-px bg-line">
                  <motion.span className="block w-full bg-accent" initial={false}
                    animate={{ height: current > i ? "100%" : "0%" }} transition={{ duration: 0.45, ease: "easeInOut" }} />
                </span>
              )}
              {/* node */}
              <span className={`relative z-10 mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 transition-colors duration-300 ${
                isDone ? (tone === "ok" ? "border-ok bg-ok text-white" : tone === "bad" ? "border-bad bg-bad text-white" : "border-accent bg-accent text-accent-fg")
                  : isActive ? "border-accent bg-surface" : "border-line-2 bg-surface"}`}>
                {isDone && (tone === "bad" ? <X size={12} strokeWidth={3} /> : <Check size={12} strokeWidth={3} />)}
                {isActive && <span className="h-2 w-2 animate-ping rounded-full bg-accent" />}
              </span>

              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-3">
                  <span className={`font-semibold transition-colors ${isActive || isDone ? "text-fg" : "text-faint"}`}>{s.name}</span>
                  <span className="font-mono text-xs text-faint">{s.tech}</span>
                </div>
                <div className="mt-1 space-y-0.5 font-mono text-xs">
                  <AnimatePresence initial={false}>
                    {lines.map(([, text, lt]) => (
                      <motion.div key={text} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.2 }}
                        className={`truncate ${lt === "ok" ? "text-ok" : lt === "bad" ? "text-bad" : "text-dim"} ${isVerdict ? "text-sm font-semibold" : ""}`}>
                        {text}
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
};

export default JudgePlayground;
