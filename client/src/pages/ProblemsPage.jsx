import React, { useState, useEffect } from "react";
import {
  Search, ChevronLeft, ChevronRight, LayoutGrid, List, CheckCircle2, CircleDashed, Circle, ChevronRight as Arrow,
} from "lucide-react";
import axios from "../api/axios";
import { useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import { useAuth } from "../context/AuthContext";

/* ─── tiny helpers ─────────────────────────────────────────── */
const DIFF_BADGE = { Easy: "badge-easy", Medium: "badge-medium", Hard: "badge-hard" };

const STATUS_META = {
  Solved:    { icon: CheckCircle2, cls: "text-ok",    label: "Solved"    },
  Attempted: { icon: CircleDashed, cls: "text-warn",  label: "Attempted" },
  Unsolved:  { icon: Circle,       cls: "text-line-2", label: "Unsolved"  },
};

const acceptanceOf = (p) => p.stats?.acceptance ?? p.acceptance;
const topicsOf = (p) => p.topics || (p.topic ? [p.topic] : []);

const ROW_COLS = "grid-cols-[28px_1fr_auto] md:grid-cols-[28px_1fr_180px_96px_120px_24px]";

/* ─── stat card ────────────────────────────────────────────── */
const StatCard = ({ label, value, hint, progress }) => (
  <div className="card p-4">
    <div className="text-xs font-medium text-dim">{label}</div>
    <div className="mt-1.5 flex items-baseline gap-2">
      <span className="text-2xl font-semibold tracking-tight">{value}</span>
      {hint && <span className="text-xs text-faint">{hint}</span>}
    </div>
    {progress !== undefined && (
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-hover">
        <div className="h-full rounded-full bg-accent transition-[width] duration-700" style={{ width: `${progress}%` }} />
      </div>
    )}
  </div>
);

/* ─── main ─────────────────────────────────────────────────── */
const ProblemsPage = () => {
  const [search, setSearch]       = useState("");
  const [difficulty, setDifficulty] = useState("");
  const [topic, setTopic]         = useState("");
  const [status, setStatus]       = useState("");
  const [page, setPage]           = useState(1);
  const [sortBy, setSortBy]       = useState("title");
  const [view, setView]           = useState("table");

  const [problems, setProblems]   = useState([]);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState(null);
  const [meta, setMeta]           = useState({ total: 0, page: 1, pages: 1 });
  const [statusMap, setStatusMap] = useState({});
  const [topics, setTopics]       = useState([]);

  const navigate = useNavigate();
  const { user } = useAuth();
  const problemsPerPage = 8;
  const totalPages = meta.pages || 1;

  /* Per-user status, derived from the user's own submissions */
  useEffect(() => {
    if (!user) { setStatusMap({}); return; }
    const fetchStatuses = async () => {
      try {
        const res = await axios.get("/api/submissions/me", { params: { limit: 500 } });
        const map = {};
        (res.data || []).forEach(sub => {
          const id = sub.problem?._id || sub.problem;
          if (!id) return;
          if (sub.status === "accepted") map[id] = "Solved";
          else if (!map[id]) map[id] = "Attempted";
        });
        setStatusMap(map);
      } catch (err) {
        console.error("Failed to load submission status", err);
      }
    };
    fetchStatuses();
  }, [user]);

  const statusOf = (p) => statusMap[p._id] || p.status || "Unsolved";
  const visible = status ? problems.filter(p => statusOf(p) === status) : problems;

  const solved = Object.values(statusMap).filter(s => s === "Solved").length;
  const attempted = Object.values(statusMap).filter(s => s === "Attempted").length;
  const stats = {
    total:    meta.total || problems.length,
    solved,
    attempted,
  };

  useEffect(() => {
    axios.get("/api/problems/topics")
      .then((res) => setTopics(res.data))
      .catch((err) => console.error("Failed to load topics", err));
  }, []);

  useEffect(() => {
    const fetchProblems = async () => {
      setLoading(true); setError(null);
      try {
        const res = await axios.get("/api/problems", {
          params: { page, limit: problemsPerPage, difficulty: difficulty || undefined,
            topic: topic || undefined, search: search || undefined, sortBy: sortBy || undefined },
        });
        setProblems(res.data.data || []);
        setMeta(res.data.meta || { total: 0, page: 1, pages: 1 });
      } catch (err) {
        setError(err?.response?.data?.message || err.message || "Failed to load problems");
      } finally { setLoading(false); }
    };
    fetchProblems();
  }, [page, difficulty, topic, search, sortBy]);

  const open = (p) => navigate(`/problem/${p.slug || p._id}`);

  const empty = (
    <div className="px-5 py-16 text-center">
      <Search size={20} className="mx-auto text-faint" />
      <p className="mt-3 text-sm font-medium">No problems found</p>
      <p className="mt-1 text-sm text-dim">Try a different search or filter.</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-subtle text-fg">
      <Navbar />

      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">

        {/* ── header ── */}
        <div className="mb-8">
          <h1 className="text-3xl font-semibold tracking-tight">Problems</h1>
          <p className="mt-1.5 text-sm text-dim">
            {meta.total} {meta.total === 1 ? "problem" : "problems"} · C++ and Java
          </p>
        </div>

        {/* ── stats row ── */}
        <div className="mb-8 grid grid-cols-2 gap-3 md:grid-cols-4">
          <StatCard label="Total problems" value={stats.total} />
          <StatCard label="Solved" value={user ? stats.solved : "—"}
            hint={user && stats.total > 0 ? `${Math.round((stats.solved / stats.total) * 100)}%` : null}
            progress={user && stats.total > 0 ? (stats.solved / stats.total) * 100 : 0} />
          <StatCard label="Attempted" value={user ? stats.attempted : "—"} />
          <StatCard label="Daily streak" value={user?.stats ? `${user.stats.dailyStreak ?? 0}d` : "—"} />
        </div>

        {/* ── toolbar ── */}
        <div className="mb-4 flex flex-wrap items-center gap-2">
          {/* search */}
          <div className="relative min-w-[220px] flex-1">
            <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-faint" />
            <input type="text" placeholder="Search problems…" value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }}
              className="field h-9 pl-9" />
          </div>

          <select value={difficulty} onChange={e => { setDifficulty(e.target.value); setPage(1); }} className="field h-9 w-auto" aria-label="Difficulty">
            <option value="">All difficulties</option>
            <option value="Easy">Easy</option>
            <option value="Medium">Medium</option>
            <option value="Hard">Hard</option>
          </select>

          <select value={topic} onChange={e => { setTopic(e.target.value); setPage(1); }} className="field h-9 w-auto" aria-label="Topic">
            <option value="">All topics</option>
            {topics.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>

          {user && (
            <select value={status} onChange={e => { setStatus(e.target.value); setPage(1); }} className="field h-9 w-auto" aria-label="Status">
              <option value="">All statuses</option>
              <option value="Solved">Solved</option>
              <option value="Attempted">Attempted</option>
              <option value="Unsolved">Unsolved</option>
            </select>
          )}

          <select value={sortBy} onChange={e => setSortBy(e.target.value)} className="field h-9 w-auto" aria-label="Sort by">
            <option value="title">Sort: Title</option>
            <option value="difficulty">Sort: Difficulty</option>
            <option value="acceptance">Sort: Acceptance</option>
          </select>

          {/* view toggle */}
          <div className="flex h-9 rounded-lg border border-line bg-surface p-0.5 shadow-card">
            {[["table", <List size={15} />], ["grid", <LayoutGrid size={15} />]].map(([v, icon]) => (
              <button key={v} onClick={() => setView(v)} aria-label={`${v} view`}
                className={`flex w-8 items-center justify-center rounded-md transition-colors ${view === v ? "bg-hover text-fg" : "text-faint hover:text-fg"}`}>
                {icon}
              </button>
            ))}
          </div>
        </div>

        {/* ── loading / error ── */}
        {loading && (
          <div className="card flex items-center justify-center gap-3 px-5 py-16 text-sm text-dim">
            <span className="spinner text-accent" /> Loading problems…
          </div>
        )}
        {error && !loading && (
          <div className="mb-5 rounded-xl border border-bad/30 bg-bad/5 px-5 py-4 text-sm text-bad">
            {error}
          </div>
        )}

        {/* ── TABLE VIEW ── */}
        {!loading && !error && view === "table" && (
          <div className="card overflow-hidden">
            {/* thead */}
            <div className={`grid ${ROW_COLS} items-center gap-4 border-b border-line bg-subtle px-5 py-2.5 text-xs font-medium text-faint`}>
              <span />
              <span>Title</span>
              <span className="hidden md:block">Topics</span>
              <span className="hidden md:block">Difficulty</span>
              <span className="hidden md:block">Acceptance</span>
              <span className="hidden md:block" />
            </div>

            {visible.length === 0 && empty}

            {visible.map((p, idx) => (
              <ProblemRow key={p._id || p.slug} p={p} n={(meta.page - 1) * problemsPerPage + idx + 1}
                st={STATUS_META[statusOf(p)] || STATUS_META.Unsolved} onSolve={() => open(p)} />
            ))}

            {problems.length > 0 && (
              <Pagination page={page} totalPages={totalPages} meta={meta}
                problemsPerPage={problemsPerPage} setPage={setPage} />
            )}
          </div>
        )}

        {/* ── GRID VIEW ── */}
        {!loading && !error && view === "grid" && (
          <>
            {visible.length > 0 ? (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {visible.map((p, idx) => (
                  <GridCard key={p._id || p.slug} p={p} n={(meta.page - 1) * problemsPerPage + idx + 1}
                    st={STATUS_META[statusOf(p)] || STATUS_META.Unsolved} onSolve={() => open(p)} />
                ))}
              </div>
            ) : <div className="card">{empty}</div>}
            {problems.length > 0 && (
              <div className="card mt-4 overflow-hidden">
                <Pagination page={page} totalPages={totalPages} meta={meta}
                  problemsPerPage={problemsPerPage} setPage={setPage} />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

/* ─── acceptance meter ─────────────────────────────────────── */
const Acceptance = ({ p }) => {
  const a = acceptanceOf(p);
  if (a == null) return <span className="text-sm text-faint">—</span>;
  return (
    <div className="flex items-center gap-2">
      <span className="w-11 text-sm tabular-nums text-dim">{Number(a).toFixed(0)}%</span>
      <span className="h-1 w-12 overflow-hidden rounded-full bg-hover">
        <span className="block h-full rounded-full bg-faint" style={{ width: `${Math.min(Number(a) || 0, 100)}%` }} />
      </span>
    </div>
  );
};

const Topics = ({ p }) => (
  <div className="flex min-w-0 flex-wrap gap-1">
    {topicsOf(p).slice(0, 2).map(t => <span key={t} className="badge badge-neutral">{t}</span>)}
    {topicsOf(p).length === 0 && <span className="text-sm text-faint">—</span>}
  </div>
);

/* ─── table row ─────────────────────────────────────────────── */
const ProblemRow = ({ p, n, st, onSolve }) => (
  <button onClick={onSolve}
    className={`group grid w-full ${ROW_COLS} items-center gap-4 border-b border-line px-5 py-3.5 text-left transition-colors last:border-b-0 hover:bg-hover`}>
    <st.icon size={17} className={st.cls} aria-label={st.label} />

    <span className="min-w-0">
      <span className="block truncate text-sm font-medium text-fg">
        <span className="mr-2 tabular-nums text-faint">{n}.</span>{p.title}
      </span>
      <span className="mt-1.5 flex gap-2 md:hidden">
        <span className={`badge ${DIFF_BADGE[p.difficulty] || "badge-neutral"}`}>{p.difficulty}</span>
      </span>
    </span>

    <span className="hidden md:block"><Topics p={p} /></span>
    <span className="hidden md:block"><span className={`badge ${DIFF_BADGE[p.difficulty] || "badge-neutral"}`}>{p.difficulty}</span></span>
    <span className="hidden md:block"><Acceptance p={p} /></span>

    <Arrow size={16} className="text-faint transition-transform group-hover:translate-x-0.5 group-hover:text-fg" />
  </button>
);

/* ─── grid card ─────────────────────────────────────────────── */
const GridCard = ({ p, n, st, onSolve }) => (
  <button onClick={onSolve}
    className="card group flex flex-col p-5 text-left transition-all hover:-translate-y-0.5 hover:border-line-2 hover:shadow-pop">
    <div className="mb-4 flex items-center justify-between">
      <span className={`badge ${DIFF_BADGE[p.difficulty] || "badge-neutral"}`}>{p.difficulty}</span>
      <st.icon size={17} className={st.cls} aria-label={st.label} />
    </div>
    <h3 className="font-medium leading-snug text-fg">
      <span className="mr-1.5 tabular-nums text-faint">{n}.</span>{p.title}
    </h3>
    <div className="mt-3"><Topics p={p} /></div>
    <div className="mt-5 flex items-center justify-between border-t border-line pt-4">
      <Acceptance p={p} />
      <span className="flex items-center gap-1 text-sm font-medium text-accent">
        Solve <Arrow size={15} className="transition-transform group-hover:translate-x-0.5" />
      </span>
    </div>
  </button>
);

/* ─── pagination ────────────────────────────────────────────── */
const Pagination = ({ page, totalPages, meta, problemsPerPage, setPage }) => (
  <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-5 py-3">
    <span className="text-sm text-dim">
      Showing <span className="font-medium text-fg">{(meta.page - 1) * problemsPerPage + 1}–{Math.min(meta.page * problemsPerPage, meta.total)}</span> of{" "}
      <span className="font-medium text-fg">{meta.total}</span>
    </span>

    <div className="flex items-center gap-1">
      <NavBtn disabled={page === 1} onClick={() => setPage(page - 1)} label="Previous page">
        <ChevronLeft size={16} />
      </NavBtn>

      {[...Array(Math.min(totalPages, 7))].map((_, i) => {
        const n = i + 1;
        return (
          <button key={n} onClick={() => setPage(n)}
            className={`h-8 min-w-8 rounded-md px-2 text-sm tabular-nums transition-colors ${
              page === n ? "bg-fg font-medium text-bg" : "text-dim hover:bg-hover hover:text-fg"}`}>
            {n}
          </button>
        );
      })}

      <NavBtn disabled={page === totalPages} onClick={() => setPage(page + 1)} label="Next page">
        <ChevronRight size={16} />
      </NavBtn>
    </div>
  </div>
);

const NavBtn = ({ disabled, onClick, children, label }) => (
  <button disabled={disabled} onClick={onClick} aria-label={label}
    className="flex h-8 w-8 items-center justify-center rounded-md text-dim transition-colors hover:bg-hover hover:text-fg disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent">
    {children}
  </button>
);

export default ProblemsPage;
