import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Pencil,
  ArrowRight,
  X,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  MapPin,
  GraduationCap,
  CalendarDays,
  MousePointerClick,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import axios from "../api/axios";
import LogoutButton from "../components/Logout";
import Navbar from "../components/Navbar";
import { useAuth } from "../context/AuthContext";

const STATUS_LABEL = {
  accepted: "Accepted",
  wrong_answer: "Wrong Answer",
  compilation_error: "Compile Error",
  runtime_error: "Runtime Error",
  error: "Internal Error",
};
const LANG_LABEL = { cpp: "C++", java: "Java", python: "Python", javascript: "JS" };
const DIFF_BADGE = { Easy: "badge-easy", Medium: "badge-medium", Hard: "badge-hard" };

/* "YYYY-MM-DD" → local Date (avoids the UTC shift of new Date(str)) */
const parseDay = (s) => {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
};
const fmtDay = (d, opts = {}) => d.toLocaleDateString("en-US", { month: "short", day: "numeric", ...opts });

/* ---------------------------- Edit modal ---------------------------- */

const EditProfileModal = ({ data, onClose, onSave }) => {
  const [form, setForm] = useState({
    fullName: data.fullName || "",
    username: data.username || "",
    bio: data.bio || "",
    education: data.education || "",
    location: data.location || "",
    preferences: {
      theme: data.preferences?.theme || "dark",
      defaultLanguage: data.preferences?.defaultLanguage || "javascript",
      editorTheme: data.preferences?.editorTheme || "vs-dark",
    },
  });

  const handleChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handlePrefChange = (field, value) => {
    setForm((prev) => ({
      ...prev,
      preferences: { ...prev.preferences, [field]: value },
    }));
  };

  const handleSubmit = async () => {
    try {
      const res = await axios.patch("/api/users/me", form);
      onSave(res.data.user);
    } catch (err) {
      console.error("Profile update failed", err);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 backdrop-blur-sm" onClick={onClose}>
      <div className="card w-full max-w-lg overflow-hidden shadow-pop" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <div>
            <h2 className="font-semibold">Edit profile</h2>
            <p className="text-sm text-dim">This is shown on your dashboard.</p>
          </div>
          <button onClick={onClose} className="btn btn-ghost btn-icon btn-sm" aria-label="Close">
            <X size={16} />
          </button>
        </div>

        <div className="space-y-4 p-5">
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="label mb-1.5">Full name</span>
              <input value={form.fullName} onChange={(e) => handleChange("fullName", e.target.value)} placeholder="Full name" className="field" />
            </label>
            <label className="block">
              <span className="label mb-1.5">Username</span>
              <input value={form.username} onChange={(e) => handleChange("username", e.target.value)} placeholder="Username" className="field" />
            </label>
          </div>

          <label className="block">
            <span className="label mb-1.5">Bio</span>
            <textarea value={form.bio} onChange={(e) => handleChange("bio", e.target.value)} placeholder="A short bio" rows={3} className="field" />
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="label mb-1.5">Education</span>
              <input value={form.education} onChange={(e) => handleChange("education", e.target.value)} placeholder="School" className="field" />
            </label>
            <label className="block">
              <span className="label mb-1.5">Location</span>
              <input value={form.location} onChange={(e) => handleChange("location", e.target.value)} placeholder="Location" className="field" />
            </label>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <label className="block">
              <span className="label mb-1.5">Theme</span>
              <select value={form.preferences.theme} onChange={(e) => handlePrefChange("theme", e.target.value)} className="field">
                <option value="dark">Dark</option>
                <option value="light">Light</option>
              </select>
            </label>
            <label className="block">
              <span className="label mb-1.5">Language</span>
              <select value={form.preferences.defaultLanguage} onChange={(e) => handlePrefChange("defaultLanguage", e.target.value)} className="field">
                <option value="javascript">JavaScript</option>
                <option value="cpp">C++</option>
                <option value="python">Python</option>
              </select>
            </label>
            <label className="block">
              <span className="label mb-1.5">Editor</span>
              <select value={form.preferences.editorTheme} onChange={(e) => handlePrefChange("editorTheme", e.target.value)} className="field">
                <option value="vs-dark">VS Dark</option>
                <option value="monokai">Monokai</option>
              </select>
            </label>
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-line bg-subtle px-5 py-3">
          <button onClick={onClose} className="btn btn-secondary">Cancel</button>
          <button onClick={handleSubmit} className="btn btn-primary">Save changes</button>
        </div>
      </div>
    </div>
  );
};

/* ---------------------------- Heatmap ---------------------------- */

const HEAT_LEVELS = ["bg-hover", "bg-accent/30", "bg-accent/55", "bg-accent/80", "bg-accent"];
const heatLevel = (count) => (count === 0 ? 0 : count <= 2 ? 1 : count <= 4 ? 2 : count <= 6 ? 3 : 4);

/* Click a day to select it, drag across days to select a range */
const Heatmap = ({ days, range, onSelect }) => {
  const [hover, setHover] = useState(null);
  const anchor = useRef(null);

  useEffect(() => {
    const stop = () => { anchor.current = null; };
    window.addEventListener("pointerup", stop);
    return () => window.removeEventListener("pointerup", stop);
  }, []);

  // Pad the start so every column is a Sun→Sat week
  const cells = [...Array(days[0].day.getDay()).fill(null), ...days];
  const weeks = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));

  // Month label on the first week that contains a new month
  let lastMonth = -1;
  const monthLabels = weeks.map((week) => {
    const first = week.find(Boolean);
    if (!first || first.day.getMonth() === lastMonth) return "";
    lastMonth = first.day.getMonth();
    return first.day.toLocaleDateString("en-US", { month: "short" });
  });
  // Drop a label that would collide with the next column's label
  monthLabels.forEach((m, i) => { if (m && monthLabels[i + 1]) monthLabels[i] = ""; });

  const cols = { gridTemplateColumns: `repeat(${weeks.length}, var(--cell))` };
  const isRange = range[1] > range[0];

  return (
    <div className="select-none [--cell:clamp(14px,2.3vw,30px)]">
      <div className="grid gap-1 pl-9" style={cols}>
        {monthLabels.map((m, i) => (
          <span key={i} className="h-5 overflow-visible whitespace-nowrap text-xs text-faint">{m}</span>
        ))}
      </div>
      <div className="flex gap-1">
        <div className="grid w-9 shrink-0 grid-rows-7 gap-1 text-[11px] text-faint">
          {["", "Mon", "", "Wed", "", "Fri", ""].map((d, i) => (
            <span key={i} className="flex items-center leading-none">{d}</span>
          ))}
        </div>
        <div className="grid gap-1" style={cols}>
          {weeks.map((week, wi) => (
            <div key={wi} className="grid grid-rows-7 gap-1">
              {Array.from({ length: 7 }).map((_, di) => {
                const d = week[di];
                if (!d) return <span key={di} className="h-[var(--cell)] w-[var(--cell)]" />;
                const selected = d.idx >= range[0] && d.idx <= range[1];
                return (
                  <button
                    key={di}
                    aria-label={`${fmtDay(d.day)}: ${d.count} submissions`}
                    aria-pressed={selected}
                    className={`h-[var(--cell)] w-[var(--cell)] rounded-[5px] transition-[box-shadow,transform,opacity] duration-150 hover:scale-110 ${HEAT_LEVELS[heatLevel(d.count)]} ${
                      isRange ? (selected ? "" : "opacity-25") : selected ? "ring-2 ring-fg ring-offset-2 ring-offset-surface" : ""}`}
                    onPointerDown={(e) => {
                      e.preventDefault();
                      anchor.current = d.idx;
                      onSelect([d.idx, d.idx]);
                    }}
                    onPointerEnter={(e) => {
                      const r = e.currentTarget.getBoundingClientRect();
                      setHover({ d, x: r.left + r.width / 2, y: r.top });
                      if (anchor.current != null) {
                        onSelect([Math.min(anchor.current, d.idx), Math.max(anchor.current, d.idx)]);
                      }
                    }}
                    onPointerLeave={() => setHover(null)}
                    onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") onSelect([d.idx, d.idx]); }}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 pl-9 text-xs text-faint">
        <span className="flex items-center gap-1.5"><MousePointerClick size={13} /> Click a day, or drag across days</span>
        <span className="flex items-center gap-1.5">
          Less
          {HEAT_LEVELS.map((c, i) => <span key={i} className={`h-3 w-3 rounded-[3px] ${c}`} />)}
          More
        </span>
      </div>

      {hover && (
        <div
          className="pointer-events-none fixed z-50 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-md bg-fg px-2.5 py-1.5 text-xs text-bg shadow-pop"
          style={{ left: hover.x, top: hover.y - 8 }}
        >
          <span className="font-semibold">{hover.d.count} {hover.d.count === 1 ? "submission" : "submissions"}</span>
          <span className="opacity-70"> · {fmtDay(hover.d.day, { year: "numeric" })}</span>
        </div>
      )}
    </div>
  );
};

/* ---------------------------- Page ---------------------------- */

const DashboardPage = () => {
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editForm, setEditForm] = useState(null);
  const [userData, setUserData] = useState({});
  const [heatmapData, setHeatmapData] = useState([]);
  const [submissions, setSubmissions] = useState([]);
  const [range, setRange] = useState(null);
  const { setUser } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const getUserData = async () => {
      try {
        const response = await axios.get("/api/auth/me");
        setUserData(response.data.user);
      } catch (error) {
        console.error("Failed to load user", error);
      }
    };

    getUserData();
  }, []);

  const handleLogout = async () => {
    const response = await axios.post("/api/auth/logout");
    if (response.data.success) {
      setUser(null);
      navigate("/login");
    } else {
      console.log(response.data.message);
    }
  };

  useEffect(() => {
    const fetchHeatmap = async () => {
      try {
        const res = await axios.get("/api/auth/me/heatmap");
        setHeatmapData(res.data.heatmap);
      } catch (err) {
        console.error("Failed to load heatmap", err);
      }
    };

    fetchHeatmap();
  }, []);

  /* All of the user's submissions: drives the stats and the day panel */
  useEffect(() => {
    const fetchSubmissions = async () => {
      try {
        const res = await axios.get("/api/submissions/me", { params: { limit: 500 } });
        setSubmissions(res.data || []);
      } catch (err) {
        console.error("Failed to load submissions", err);
      }
    };

    fetchSubmissions();
  }, []);

  const days = heatmapData.map((d, idx) => ({ ...d, idx, day: parseDay(d.date) }));
  const lastIdx = days.length - 1;
  const [lo, hi] = range || [lastIdx, lastIdx];

  /* Stats computed from real submissions */
  const accepted = submissions.filter((s) => s.status === "accepted");
  const solved = new Set(accepted.map((s) => s.problem?._id)).size;
  const acceptance = submissions.length ? Math.round((accepted.length / submissions.length) * 100) : 0;
  let streak = 0;
  for (let i = days[lastIdx]?.count ? lastIdx : lastIdx - 1; i >= 0 && days[i].count > 0; i--) streak++;
  const recentTotal = days.reduce((s, d) => s + d.count, 0);

  /* Submissions inside the selected day(s). Heatmap keys are UTC dates. */
  const keys = new Set(days.slice(lo, hi + 1).map((d) => d.date));
  const picked = submissions.filter((s) => keys.has(String(s.createdAt).slice(0, 10)));
  const pickedOk = picked.filter((s) => s.status === "accepted").length;
  const isRange = hi > lo;
  const rangeLabel = days.length === 0 ? "" : isRange
    ? `${fmtDay(days[lo].day)} – ${fmtDay(days[hi].day)}`
    : lo === lastIdx ? "Today" : days[lo].day.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });

  const initials = userData.fullName
    ?.split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  const firstName = userData.fullName?.split(" ")[0];

  const stats = [
    { label: "Solved", value: solved },
    { label: "Acceptance", value: `${acceptance}%` },
    { label: "Day streak", value: streak },
    { label: "Last 12 weeks", value: recentTotal, hint: "submissions" },
  ];

  return (
    <div className="min-h-screen bg-subtle text-fg">
      <Navbar />
      <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        {/* Header */}
        <div className="mb-8 flex flex-wrap items-start justify-between gap-6">
          <div className="flex min-w-0 items-center gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-accent text-lg font-semibold text-accent-fg shadow-card">
              {initials}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="truncate text-2xl font-semibold tracking-tight">
                  {firstName ? `Hey, ${firstName}` : "Dashboard"}
                </h1>
                <button
                  onClick={() => {
                    setEditForm(userData);
                    setIsEditOpen(true);
                  }}
                  className="btn btn-ghost btn-icon btn-sm"
                  aria-label="Edit profile"
                  title="Edit profile"
                >
                  <Pencil size={14} />
                </button>
              </div>
              <div className="mt-0.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-dim">
                {userData.username && <span>@{userData.username}</span>}
                {userData.location && <span className="flex items-center gap-1.5"><MapPin size={13} />{userData.location}</span>}
                {userData.education && <span className="flex items-center gap-1.5"><GraduationCap size={13} />{userData.education}</span>}
                {userData.createdAt && (
                  <span className="flex items-center gap-1.5">
                    <CalendarDays size={13} />
                    Joined {new Date(userData.createdAt).toLocaleDateString("en-US", { month: "short", year: "numeric" })}
                  </span>
                )}
              </div>
              {userData.bio && <p className="mt-2 max-w-xl text-sm text-dim">{userData.bio}</p>}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <LogoutButton onLogout={handleLogout} />
            <button onClick={() => navigate("/problems")} className="btn btn-primary">
              Solve problems <ArrowRight size={15} />
            </button>
          </div>
        </div>

        {/* Activity */}
        <section className="card overflow-hidden">
          <div className="grid grid-cols-2 divide-line border-b border-line sm:grid-cols-4 sm:divide-x">
            {stats.map((s) => (
              <div key={s.label} className="px-5 py-4">
                <div className="text-xs font-medium text-dim">{s.label}</div>
                <div className="mt-1 text-2xl font-semibold tracking-tight tabular-nums">
                  {s.value}
                  {s.hint && <span className="ml-1.5 text-xs font-normal text-faint">{s.hint}</span>}
                </div>
              </div>
            ))}
          </div>

          <div className="grid lg:grid-cols-[auto_1fr]">
            <div className="overflow-x-auto p-5 sm:p-6">
              {days.length > 0
                ? <Heatmap days={days} range={[lo, hi]} onSelect={setRange} />
                : <div className="flex h-56 w-[420px] max-w-full items-center justify-center text-sm text-faint">No activity yet.</div>}
            </div>

            {/* Selected day(s) */}
            <div className="flex min-h-[280px] flex-col border-t border-line lg:border-l lg:border-t-0">
              <div className="flex items-center justify-between gap-3 px-5 pb-3 pt-5">
                <div>
                  <h2 className="font-semibold">{rangeLabel}</h2>
                  <p className="text-xs text-dim">
                    {picked.length} {picked.length === 1 ? "submission" : "submissions"}
                    {picked.length > 0 && ` · ${pickedOk} accepted`}
                  </p>
                </div>
                {range && (
                  <button onClick={() => setRange(null)} className="btn btn-ghost btn-sm">Today</button>
                )}
              </div>

              <div className="max-h-[300px] flex-1 overflow-y-auto px-2 pb-3">
                <AnimatePresence mode="popLayout" initial={false}>
                  {picked.length === 0 ? (
                    <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                      className="flex h-full min-h-[180px] flex-col items-center justify-center gap-3 text-center text-sm text-faint">
                      {lo === lastIdx && !isRange ? "Nothing submitted yet today." : "No submissions here."}
                      <button onClick={() => navigate("/problems")} className="btn btn-secondary btn-sm">
                        Pick a problem <ArrowRight size={14} />
                      </button>
                    </motion.div>
                  ) : picked.map((sub, i) => {
                    const ok = sub.status === "accepted";
                    const Icon = ok ? CheckCircle2 : sub.status === "wrong_answer" ? XCircle : AlertTriangle;
                    const when = new Date(sub.createdAt);
                    return (
                      <motion.button
                        key={sub._id}
                        layout
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0, transition: { delay: Math.min(i, 8) * 0.025 } }}
                        exit={{ opacity: 0 }}
                        onClick={() => sub.problem?.slug && navigate(`/problem/${sub.problem.slug}`)}
                        className="group flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-hover"
                      >
                        <Icon size={16} className={`shrink-0 ${ok ? "text-ok" : sub.status === "wrong_answer" ? "text-bad" : "text-warn"}`} />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium">{sub.problem?.title || "Deleted problem"}</span>
                          <span className="block text-xs text-dim">{STATUS_LABEL[sub.status] || sub.status}</span>
                        </span>
                        {sub.problem?.difficulty && (
                          <span className={`badge hidden sm:inline-flex ${DIFF_BADGE[sub.problem.difficulty] || "badge-neutral"}`}>{sub.problem.difficulty}</span>
                        )}
                        <span className="badge badge-neutral">{LANG_LABEL[sub.language] || sub.language}</span>
                        <span className="w-[72px] shrink-0 text-right text-xs tabular-nums text-faint">
                          {isRange && <span className="block">{fmtDay(when)}</span>}
                          {when.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </span>
                        <ArrowRight size={14} className="shrink-0 text-faint opacity-0 transition-opacity group-hover:opacity-100" />
                      </motion.button>
                    );
                  })}
                </AnimatePresence>
              </div>
            </div>
          </div>
        </section>
      </main>

      {isEditOpen && (
        <EditProfileModal
          data={editForm}
          onClose={() => setIsEditOpen(false)}
          onSave={(updatedUser) => {
            setUserData(updatedUser);
            setIsEditOpen(false);
          }}
        />
      )}
    </div>
  );
};

export default DashboardPage;
