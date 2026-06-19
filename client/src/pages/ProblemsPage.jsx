import React, { useState, useEffect } from "react";
import {
  Search, ChevronLeft, ChevronRight, TrendingUp, Award,
  CheckCircle2, XCircle, Clock, BarChart2, Zap, Target,
  LayoutGrid, List, ArrowUpDown, Code2
} from "lucide-react";
import axios from "../api/axios";
import { useNavigate } from "react-router-dom";

/* ─── tiny helpers ─────────────────────────────────────────── */
const DIFF_META = {
  Easy:   { color: "#22c55e", bg: "rgba(34,197,94,0.08)",   border: "rgba(34,197,94,0.25)"   },
  Medium: { color: "#f59e0b", bg: "rgba(245,158,11,0.08)",  border: "rgba(245,158,11,0.25)"  },
  Hard:   { color: "#ef4444", bg: "rgba(239,68,68,0.08)",   border: "rgba(239,68,68,0.25)"   },
};

const STATUS_META = {
  Solved:    { color: "#22c55e", icon: <CheckCircle2 size={11} />, label: "Solved"    },
  Attempted: { color: "#f59e0b", icon: <Clock        size={11} />, label: "Attempted" },
  Unsolved:  { color: "#6b7280", icon: <XCircle      size={11} />, label: "Unsolved"  },
};

/* ─── ring progress ────────────────────────────────────────── */
const Ring = ({ value, max, color, size = 56 }) => {
  const r = 22, c = 2 * Math.PI * r;
  const pct = max > 0 ? value / max : 0;
  return (
    <svg width={size} height={size} viewBox="0 0 56 56" style={{ transform: "rotate(-90deg)" }}>
      <circle cx="28" cy="28" r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="4" />
      <circle cx="28" cy="28" r={r} fill="none" stroke={color} strokeWidth="4"
        strokeDasharray={c} strokeDashoffset={c * (1 - pct)}
        strokeLinecap="round" style={{ transition: "stroke-dashoffset 0.8s ease" }} />
    </svg>
  );
};

/* ─── stat card ────────────────────────────────────────────── */
const StatCard = ({ icon, label, value, sub, color, ring, ringMax }) => (
  <div style={{
    background: "rgba(255,255,255,0.03)",
    border: "1px solid rgba(255,255,255,0.07)",
    borderRadius: 16,
    padding: "18px 20px",
    display: "flex", alignItems: "center", gap: 14,
    transition: "border-color 0.2s, transform 0.2s",
  }}
    onMouseEnter={e => { e.currentTarget.style.borderColor = color + "55"; e.currentTarget.style.transform = "translateY(-2px)"; }}
    onMouseLeave={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.07)"; e.currentTarget.style.transform = "translateY(0)"; }}
  >
    {ring !== undefined
      ? <div style={{ position: "relative", flexShrink: 0 }}>
          <Ring value={ring} max={ringMax} color={color} />
          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", transform: "rotate(90deg)" }}>
            <span style={{ fontSize: 11, fontWeight: 700, color }}>{ringMax > 0 ? Math.round((ring / ringMax) * 100) : 0}%</span>
          </div>
        </div>
      : <div style={{ width: 42, height: 42, borderRadius: 12, background: color + "18", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          {React.cloneElement(icon, { size: 18, color })}
        </div>
    }
    <div>
      <div style={{ fontSize: 22, fontWeight: 800, color: "#f1f5f9", lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 12, color: "#64748b", marginTop: 3, fontWeight: 500 }}>{label}</div>
      {sub && <div style={{ fontSize: 11, color: color, marginTop: 2, fontWeight: 600 }}>{sub}</div>}
    </div>
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

  const navigate = useNavigate();
  const problemsPerPage = 8;
  const totalPages = meta.pages || 1;

  const stats = {
    total:    meta.total || problems.length,
    solved:   problems.filter(p => p.status === "Solved").length,
    attempted:problems.filter(p => p.status === "Attempted").length,
    easy:     problems.filter(p => p.difficulty === "Easy").length,
    medium:   problems.filter(p => p.difficulty === "Medium").length,
    hard:     problems.filter(p => p.difficulty === "Hard").length,
  };

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

  /* shared select style */
  const sel = {
    background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 10, color: "#cbd5e1", fontSize: 13, padding: "9px 14px",
    outline: "none", cursor: "pointer", appearance: "none", WebkitAppearance: "none",
    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2364748b' stroke-width='2'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`,
    backgroundRepeat: "no-repeat", backgroundPosition: "right 12px center",
    paddingRight: 32, minWidth: 140,
  };

  return (
    <div style={{ minHeight: "100vh", background: "#0a0a0f", color: "#e2e8f0", fontFamily: "'Inter', system-ui, sans-serif" }}>
      {/* ambient glow */}
      <div style={{ position: "fixed", inset: 0, pointerEvents: "none", overflow: "hidden", zIndex: 0 }}>
        <div style={{ position: "absolute", top: -100, left: "20%", width: 500, height: 500, borderRadius: "50%", background: "radial-gradient(circle, rgba(139,92,246,0.07) 0%, transparent 70%)" }} />
        <div style={{ position: "absolute", bottom: -100, right: "10%", width: 400, height: 400, borderRadius: "50%", background: "radial-gradient(circle, rgba(59,130,246,0.06) 0%, transparent 70%)" }} />
      </div>

      <div style={{ position: "relative", zIndex: 1, maxWidth: 1200, margin: "0 auto", padding: "40px 24px" }}>

        {/* ── header ── */}
        <div style={{ marginBottom: 36 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
            <Code2 size={28} color="#8b5cf6" />
            <h1 style={{ fontSize: 32, fontWeight: 800, background: "linear-gradient(135deg, #a78bfa 0%, #60a5fa 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", margin: 0 }}>
              Problems
            </h1>
          </div>
          <p style={{ color: "#475569", fontSize: 14, margin: 0 }}>
            {meta.total} challenges • sharpen your problem-solving
          </p>
        </div>

        {/* ── stats row ── */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12, marginBottom: 28 }}>
          <StatCard icon={<Target />} label="Total Problems" value={stats.total} color="#8b5cf6" />
          <StatCard icon={<CheckCircle2 />} label="Solved" value={stats.solved}
            sub={stats.total > 0 ? `${Math.round((stats.solved / stats.total) * 100)}% complete` : null}
            color="#22c55e" ring={stats.solved} ringMax={stats.total} />
          <StatCard icon={<Clock />} label="Attempted" value={stats.attempted} color="#f59e0b" />
          <StatCard icon={<Award />} label="Streak" value="—" color="#60a5fa" />
        </div>

        {/* ── filters bar ── */}
        <div style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 16, padding: "18px 20px", marginBottom: 20 }}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
            {/* search */}
            <div style={{ flex: "1 1 220px", display: "flex", alignItems: "center", gap: 10,
              background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: 10, padding: "9px 14px" }}>
              <Search size={15} color="#64748b" />
              <input type="text" placeholder="Search problems…" value={search}
                onChange={e => { setSearch(e.target.value); setPage(1); }}
                style={{ background: "transparent", border: "none", outline: "none", color: "#e2e8f0", fontSize: 13, width: "100%" }} />
            </div>

            <select value={difficulty} onChange={e => { setDifficulty(e.target.value); setPage(1); }} style={sel}>
              <option value="">All Difficulties</option>
              <option value="Easy">Easy</option>
              <option value="Medium">Medium</option>
              <option value="Hard">Hard</option>
            </select>

            <select value={topic} onChange={e => { setTopic(e.target.value); setPage(1); }} style={sel}>
              <option value="">All Topics</option>
              <option value="Arrays">Arrays</option>
              <option value="Binary Search">Binary Search</option>
              <option value="DP">Dynamic Programming</option>
              <option value="Graphs">Graphs</option>
              <option value="Stack">Stack</option>
              <option value="BFS">BFS</option>
            </select>

            <select value={status} onChange={e => { setStatus(e.target.value); setPage(1); }} style={sel}>
              <option value="">All Status</option>
              <option value="Solved">Solved</option>
              <option value="Attempted">Attempted</option>
              <option value="Unsolved">Unsolved</option>
            </select>

            {/* sort pills */}
            <div style={{ display: "flex", gap: 6, marginLeft: "auto" }}>
              {["title", "difficulty", "acceptance"].map(s => (
                <button key={s} onClick={() => setSortBy(s)} style={{
                  padding: "7px 14px", borderRadius: 8, fontSize: 12, fontWeight: 600,
                  border: "1px solid", cursor: "pointer", transition: "all 0.15s",
                  background: sortBy === s ? "rgba(139,92,246,0.2)" : "transparent",
                  borderColor: sortBy === s ? "#8b5cf6" : "rgba(255,255,255,0.08)",
                  color: sortBy === s ? "#a78bfa" : "#64748b",
                  display: "flex", alignItems: "center", gap: 5,
                }}>
                  <ArrowUpDown size={11} />
                  {s.charAt(0).toUpperCase() + s.slice(1)}
                </button>
              ))}
            </div>

            {/* view toggle */}
            <div style={{ display: "flex", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, overflow: "hidden" }}>
              {[["table", <List size={15} />], ["grid", <LayoutGrid size={15} />]].map(([v, icon]) => (
                <button key={v} onClick={() => setView(v)} style={{
                  padding: "8px 12px", border: "none", cursor: "pointer", transition: "all 0.15s",
                  background: view === v ? "rgba(139,92,246,0.25)" : "transparent",
                  color: view === v ? "#a78bfa" : "#64748b",
                }}>
                  {icon}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ── loading / error ── */}
        {loading && (
          <div style={{ textAlign: "center", padding: "60px 0" }}>
            <div style={{ display: "inline-block", width: 36, height: 36, border: "3px solid rgba(139,92,246,0.2)", borderTopColor: "#8b5cf6", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />
            <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
          </div>
        )}
        {error && !loading && (
          <div style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 12, padding: "16px 20px", color: "#f87171", fontSize: 14, marginBottom: 20 }}>
            {error}
          </div>
        )}

        {/* ── TABLE VIEW ── */}
        {!loading && !error && view === "table" && (
          <div style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 16, overflow: "hidden" }}>
            {/* thead */}
            <div style={{ display: "grid", gridTemplateColumns: "60px 1fr 110px 130px 100px 110px 110px", padding: "12px 20px",
              background: "rgba(255,255,255,0.03)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
              {["#", "Problem", "Difficulty", "Topic", "Acceptance", "Status", ""].map((h, i) => (
                <span key={i} style={{ fontSize: 11, fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.06em" }}>{h}</span>
              ))}
            </div>

            {/* rows */}
            {problems.length === 0 && (
              <div style={{ padding: "64px 0", textAlign: "center", color: "#334155" }}>
                <Code2 size={40} style={{ margin: "0 auto 12px", display: "block", opacity: 0.4 }} />
                <p style={{ margin: 0, fontSize: 14 }}>No problems match your filters.</p>
              </div>
            )}

            {problems.map((p, idx) => {
              const diff = DIFF_META[p.difficulty] || DIFF_META.Easy;
              const st = STATUS_META[p.status] || STATUS_META.Unsolved;
              return (
                <ProblemRow key={p.id} p={p} diff={diff} st={st} idx={idx}
                  onSolve={() => navigate(`/problem/${p.slug || p.id}`)} />
              );
            })}

            {/* pagination */}
            {problems.length > 0 && (
              <Pagination page={page} totalPages={totalPages} meta={meta}
                problemsPerPage={problemsPerPage} setPage={setPage} />
            )}
          </div>
        )}

        {/* ── GRID VIEW ── */}
        {!loading && !error && view === "grid" && (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 16 }}>
              {problems.map(p => {
                const diff = DIFF_META[p.difficulty] || DIFF_META.Easy;
                const st = STATUS_META[p.status] || STATUS_META.Unsolved;
                return (
                  <GridCard key={p.id} p={p} diff={diff} st={st}
                    onSolve={() => navigate(`/problem/${p.slug || p.id}`)} />
                );
              })}
            </div>
            {problems.length === 0 && (
              <div style={{ padding: "64px 0", textAlign: "center", color: "#334155" }}>
                <Code2 size={40} style={{ margin: "0 auto 12px", display: "block", opacity: 0.4 }} />
                <p style={{ margin: 0, fontSize: 14 }}>No problems match your filters.</p>
              </div>
            )}
            {problems.length > 0 && (
              <div style={{ marginTop: 24 }}>
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

/* ─── table row ─────────────────────────────────────────────── */
const ProblemRow = ({ p, diff, st, idx, onSolve }) => {
  const [hov, setHov] = useState(false);
  return (
    <div onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{
        display: "grid", gridTemplateColumns: "60px 1fr 110px 130px 100px 110px 110px",
        padding: "14px 20px", alignItems: "center",
        borderBottom: "1px solid rgba(255,255,255,0.04)",
        background: hov ? "rgba(139,92,246,0.04)" : "transparent",
        transition: "background 0.15s",
      }}>
      <span style={{ fontSize: 12, color: "#334155", fontFamily: "monospace" }}>
        {String(idx + 1).padStart(2, "0")}
      </span>

      <span style={{ fontWeight: 600, fontSize: 14, color: hov ? "#a78bfa" : "#cbd5e1", transition: "color 0.15s", cursor: "pointer" }}
        onClick={onSolve}>
        {p.title}
      </span>

      <span style={{ display: "inline-flex", alignItems: "center", padding: "3px 10px", borderRadius: 6,
        background: diff.bg, border: `1px solid ${diff.border}`, color: diff.color,
        fontSize: 11, fontWeight: 700, width: "fit-content" }}>
        {p.difficulty}
      </span>

      <span style={{ fontSize: 12, color: "#60a5fa" }}>{p.topic}</span>

      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <BarChart2 size={12} color="#475569" />
        <span style={{ fontSize: 13, color: "#94a3b8" }}>{p.acceptance}%</span>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
        <div style={{ width: 7, height: 7, borderRadius: "50%", background: st.color, flexShrink: 0 }} />
        <span style={{ fontSize: 12, color: st.color, fontWeight: 600 }}>{p.status || "Unsolved"}</span>
      </div>

      <button onClick={onSolve} style={{
        display: "flex", alignItems: "center", gap: 6, padding: "7px 16px",
        borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: "pointer", border: "none",
        background: hov ? "linear-gradient(135deg,#8b5cf6,#3b82f6)" : "rgba(139,92,246,0.15)",
        color: hov ? "#fff" : "#a78bfa",
        transition: "all 0.2s", letterSpacing: "0.02em",
      }}>
        <Zap size={12} /> Solve
      </button>
    </div>
  );
};

/* ─── grid card ─────────────────────────────────────────────── */
const GridCard = ({ p, diff, st, onSolve }) => {
  const [hov, setHov] = useState(false);
  return (
    <div onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{
        background: "rgba(255,255,255,0.025)", borderRadius: 16, padding: "20px",
        border: `1px solid ${hov ? "rgba(139,92,246,0.35)" : "rgba(255,255,255,0.07)"}`,
        transition: "all 0.2s", transform: hov ? "translateY(-3px)" : "none",
        boxShadow: hov ? "0 12px 32px rgba(139,92,246,0.12)" : "none",
        cursor: "default",
      }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
        <span style={{ fontSize: 11, color: "#334155", fontFamily: "monospace" }}>#{p.id}</span>
        <span style={{ padding: "3px 10px", borderRadius: 6, background: diff.bg,
          border: `1px solid ${diff.border}`, color: diff.color, fontSize: 11, fontWeight: 700 }}>
          {p.difficulty}
        </span>
      </div>

      <h3 style={{ fontSize: 15, fontWeight: 700, color: "#e2e8f0", margin: "0 0 12px", lineHeight: 1.4 }}>
        {p.title}
      </h3>

      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18, fontSize: 12, color: "#64748b" }}>
        <span style={{ color: "#60a5fa" }}>{p.topic}</span>
        <span>·</span>
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <BarChart2 size={12} /> {p.acceptance}%
        </div>
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <div style={{ width: 7, height: 7, borderRadius: "50%", background: st.color }} />
          <span style={{ fontSize: 11, fontWeight: 600, color: st.color }}>{p.status || "Unsolved"}</span>
        </div>
        <button onClick={onSolve} style={{
          display: "flex", alignItems: "center", gap: 6, padding: "8px 18px",
          borderRadius: 9, fontSize: 12, fontWeight: 700, cursor: "pointer", border: "none",
          background: "linear-gradient(135deg,#8b5cf6,#3b82f6)", color: "#fff",
          transition: "opacity 0.15s", opacity: hov ? 1 : 0.85,
        }}>
          <Zap size={12} /> Solve
        </button>
      </div>
    </div>
  );
};

/* ─── pagination ────────────────────────────────────────────── */
const Pagination = ({ page, totalPages, meta, problemsPerPage, setPage }) => (
  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center",
    padding: "16px 20px", borderTop: "1px solid rgba(255,255,255,0.06)",
    background: "rgba(255,255,255,0.02)", flexWrap: "wrap", gap: 12 }}>
    <span style={{ fontSize: 12, color: "#475569" }}>
      Showing <b style={{ color: "#94a3b8" }}>{(meta.page - 1) * problemsPerPage + 1}</b>
      {" "}–{" "}
      <b style={{ color: "#94a3b8" }}>{Math.min(meta.page * problemsPerPage, meta.total)}</b>
      {" "}of <b style={{ color: "#94a3b8" }}>{meta.total}</b> problems
    </span>

    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <NavBtn disabled={page === 1} onClick={() => setPage(page - 1)}>
        <ChevronLeft size={16} />
      </NavBtn>

      {[...Array(Math.min(totalPages, 7))].map((_, i) => {
        const n = i + 1;
        return (
          <button key={n} onClick={() => setPage(n)} style={{
            width: 34, height: 34, borderRadius: 8, fontSize: 13, fontWeight: 600,
            border: "1px solid", cursor: "pointer", transition: "all 0.15s",
            background: page === n ? "linear-gradient(135deg,#8b5cf6,#3b82f6)" : "transparent",
            borderColor: page === n ? "transparent" : "rgba(255,255,255,0.08)",
            color: page === n ? "#fff" : "#64748b",
          }}>{n}</button>
        );
      })}

      <NavBtn disabled={page === totalPages} onClick={() => setPage(page + 1)}>
        <ChevronRight size={16} />
      </NavBtn>
    </div>
  </div>
);

const NavBtn = ({ disabled, onClick, children }) => (
  <button disabled={disabled} onClick={onClick} style={{
    width: 34, height: 34, borderRadius: 8, display: "flex", alignItems: "center",
    justifyContent: "center", border: "1px solid rgba(255,255,255,0.08)",
    background: "transparent", color: disabled ? "#1e293b" : "#64748b",
    cursor: disabled ? "not-allowed" : "pointer", transition: "all 0.15s",
  }}>
    {children}
  </button>
);

export default ProblemsPage;