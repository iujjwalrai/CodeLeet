import React from "react";
import { motion } from "framer-motion";
import { ArrowRight, Play, Check, Send } from "lucide-react";
import { useNavigate } from "react-router-dom";
import Navbar, { Logo } from "../components/Navbar";
import CursorGlow from "../components/CursorGlow";
import JudgePlayground from "../components/JudgePlayground";
import { useAuth } from "../context/AuthContext";

const fadeUp = {
  initial: { opacity: 0, y: 16 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-60px" },
  transition: { duration: 0.45 },
};

/* ─── hero product preview ───────────────────────────────────── */
const CODE = [
  [["kw", "class"], ["", " "], ["ty", "Solution"], ["", " {"]],
  [["", "  "], ["ty", "int"], ["", " add("], ["ty", "int"], ["", " a, "], ["ty", "int"], ["", " b) {"]],
  [["", "    "], ["kw", "return"], ["", " a + b;"]],
  [["", "  }"]],
  [["", "}"]],
];
const TOKEN = { kw: "text-[#c026d3] dark:text-[#e879f9]", ty: "text-[#0891b2] dark:text-[#67e8f9]", "": "" };

const Preview = () => (
  <div className="card overflow-hidden shadow-pop">
    {/* window bar */}
    <div className="flex h-10 items-center justify-between border-b border-line bg-subtle px-4">
      <div className="flex items-center gap-2 text-xs text-dim">
        <span className="font-medium text-fg">Sum Check</span>
        <span className="badge badge-easy">Easy</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="btn btn-secondary btn-sm pointer-events-none h-7 text-xs"><Play size={12} /> Run</span>
        <span className="btn btn-primary btn-sm pointer-events-none h-7 text-xs"><Send size={12} /> Submit</span>
      </div>
    </div>
    <div className="grid md:grid-cols-[1fr_1.35fr]">
      {/* problem */}
      <div className="hidden border-r border-line p-5 text-left md:block">
        <p className="text-sm leading-relaxed text-dim">Given two integers <code className="font-mono text-fg">a</code> and <code className="font-mono text-fg">b</code>, return their sum.</p>
        <div className="mt-4 rounded-lg border border-line bg-subtle p-3 font-mono text-xs leading-6">
          <div><span className="text-faint">input </span> 1 2</div>
          <div><span className="text-faint">output</span> 3</div>
        </div>
      </div>
      {/* editor + result */}
      <div className="flex flex-col text-left">
        <div className="flex-1 bg-subtle px-4 py-4 font-mono text-[13px] leading-6">
          {CODE.map((line, i) => (
            <div key={i} className="flex">
              <span className="w-6 shrink-0 select-none text-faint">{i + 1}</span>
              <span className="whitespace-pre text-fg">
                {line.map(([t, v], j) => <span key={j} className={TOKEN[t]}>{v}</span>)}
              </span>
            </div>
          ))}
        </div>
        <div className="flex items-center justify-between gap-3 border-t border-line px-4 py-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-ok">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-ok/15"><Check size={12} strokeWidth={3} /></span>
            Accepted
          </div>
          <div className="flex gap-4 font-mono text-xs text-dim">
            <span>3/3 tests</span><span>42 ms</span>
          </div>
        </div>
      </div>
    </div>
  </div>
);

/* ─── sandbox flags ─────────────────────────────────────────── */
const LIMITS = [
  ["--network none", "No network. Nothing gets in or out."],
  ["--user nobody", "Runs as an unprivileged user, never root."],
  ["--read-only", "Root filesystem is immutable."],
  ["--tmpfs /tmp 32m", "Small scratch space for compiled binaries."],
  ["--pids-limit 64", "Fork bombs hit a ceiling."],
  ["--memory 256m", "Hard memory cap, swap disabled."],
  ["--cpus 1.0", "One core per run."],
  ["timeout 3s", "Per test case. Infinite loops get killed."],
];

const STACK = ["React", "Monaco", "Express", "MongoDB", "Redis", "BullMQ", "Docker", "WebSocket"];

const Home = () => {
  const naviagte = useNavigate();
  const { user } = useAuth();
  const start = () => { if (user) naviagte("/dashboard"); else naviagte("/login") };
  return (
    <div className="relative isolate min-h-screen w-full bg-bg text-fg">
      <CursorGlow />
      <Navbar />

      {/* ── Hero ── */}
      <section data-glow="emerald" className="relative overflow-hidden">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 [mask-image:linear-gradient(to_bottom,black,transparent_70%)]"
          style={{ backgroundImage: "linear-gradient(var(--line) 1px, transparent 1px), linear-gradient(90deg, var(--line) 1px, transparent 1px)", backgroundSize: "48px 48px", opacity: 0.5 }}
        />

        <div className="relative mx-auto max-w-6xl px-4 pb-20 pt-16 text-center sm:px-6 sm:pt-24">
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
            <h1 className="mx-auto max-w-3xl text-4xl font-semibold leading-[1.1] tracking-[-0.03em] sm:text-6xl">
              Write code.{" "}
              <span className="bg-gradient-to-b from-accent to-[color-mix(in_srgb,var(--accent)_60%,var(--fg))] bg-clip-text text-transparent">Get a verdict.</span>
            </h1>
            <p className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-dim sm:text-lg">
              An online judge that compiles your code in an isolated container
              and streams the result back over WebSocket.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <button className="btn btn-primary btn-lg" onClick={start}>
                Get Started
                <ArrowRight size={16} />
              </button>
              <button className="btn btn-secondary btn-lg" onClick={() => naviagte("/problems")}>
                View Problems
              </button>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.15 }}
            className="mx-auto mt-14 max-w-4xl"
          >
            <Preview />
          </motion.div>
        </div>
      </section>

      {/* ── Playground ── */}
      <section data-glow="cyan" className="border-t border-line">
        <div className="mx-auto max-w-6xl px-4 py-24 sm:px-6">
          <motion.div {...fadeUp} className="mb-12 grid gap-4 lg:grid-cols-[1fr_1.1fr] lg:gap-10">
            <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
              What happens when<br className="hidden sm:block" /> you hit Run.
            </h2>
            <p className="max-w-md self-end text-dim">
              Pick a file and run it. Every step on the right is a real part of the
              stack, in the order your code passes through it.
            </p>
          </motion.div>
          <JudgePlayground />
        </div>
      </section>

      {/* ── Sandbox ── */}
      <section data-glow="violet" className="border-t border-line">
        <div className="mx-auto grid max-w-6xl gap-12 px-4 py-24 sm:px-6 lg:grid-cols-[1fr_1.3fr]">
          <motion.div {...fadeUp} className="lg:sticky lg:top-24 lg:self-start">
            <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
              Your code runs with almost nothing.
            </h2>
            <p className="mt-4 max-w-sm leading-relaxed text-dim">
              Each run gets a fresh container started with these flags. When the
              run ends, the container is gone.
            </p>
            <div className="mt-8 flex flex-wrap gap-x-5 gap-y-2">
              {STACK.map(s => <span key={s} className="font-mono text-xs text-faint">{s}</span>)}
            </div>
          </motion.div>
          <motion.dl {...fadeUp} className="divide-y divide-line border-y border-line">
            {LIMITS.map(([flag, desc]) => (
              <div key={flag} className="group grid gap-1 py-4 transition-colors sm:grid-cols-[190px_1fr] sm:gap-6">
                <dt className="font-mono text-sm text-fg transition-colors group-hover:text-accent">{flag}</dt>
                <dd className="text-sm text-dim">{desc}</dd>
              </div>
            ))}
          </motion.dl>
        </div>
      </section>

      {/* ── CTA ── */}
      <section data-glow="amber" className="border-t border-line">
        <motion.div {...fadeUp} className="mx-auto max-w-6xl px-4 py-24 text-center sm:px-6">
          <h2 className="relative text-3xl font-semibold tracking-tight">Pick a problem. Press Run.</h2>
          <p className="relative mx-auto mt-3 max-w-md text-dim">
            Run checks your code against the tests. Submit saves it to your history.
          </p>
          <button className="btn btn-primary btn-lg relative mt-7" onClick={start}>
            Start Coding Now
            <ArrowRight size={16} />
          </button>
        </motion.div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-8 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <Logo small />
        </div>
      </footer>
    </div>
  );
};

export default Home;
