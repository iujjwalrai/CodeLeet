import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Search, CornerDownLeft, FileCode2, LayoutDashboard, ListChecks, Home, SunMoon, LogIn } from "lucide-react";
import { useNavigate } from "react-router-dom";
import axios from "../api/axios";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../theme";

const DIFF_BADGE = { Easy: "badge-easy", Medium: "badge-medium", Hard: "badge-hard" };

const isMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);

/* ⌘K / Ctrl+K palette: live problem search plus quick actions */
const CommandPalette = ({ open, onClose }) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toggle } = useTheme();
  const [query, setQuery] = useState("");
  const [found, setFound] = useState({ q: null, items: [] });
  const [active, setActive] = useState(0);
  const inputRef = useRef(null);

  // Debounced search; results are tagged with the query they belong to
  useEffect(() => {
    if (!open) return;
    const q = query.trim();
    const t = setTimeout(async () => {
      try {
        const res = await axios.get("/api/problems", { params: { search: q || undefined, limit: 6 } });
        setFound({ q, items: res.data.data || [] });
      } catch {
        setFound({ q, items: [] });
      }
    }, 180);
    return () => clearTimeout(t);
  }, [query, open]);

  const close = () => { setQuery(""); setActive(0); onClose(); };
  const go = (to) => { close(); navigate(to); };

  const q = query.trim().toLowerCase();
  const problems = found.q === query.trim() ? found.items : [];
  const actions = [
    { label: "Problems", hint: "Browse all problems", icon: ListChecks, run: () => go("/problems") },
    user && { label: "Dashboard", hint: "Your activity", icon: LayoutDashboard, run: () => go("/dashboard") },
    { label: "Home", hint: "Landing page", icon: Home, run: () => go("/") },
    { label: "Toggle theme", hint: "Light / dark", icon: SunMoon, run: () => { toggle(); close(); } },
    !user && { label: "Sign in", hint: "Log in to your account", icon: LogIn, run: () => go("/login") },
  ].filter(Boolean).filter(a => !q || a.label.toLowerCase().includes(q));

  const items = [
    ...problems.map(p => ({ kind: "problem", p, run: () => go(`/problem/${p.slug || p._id}`) })),
    ...actions.map(a => ({ kind: "action", a, run: a.run })),
  ];
  const current = Math.min(active, Math.max(items.length - 1, 0));

  const onKeyDown = (e) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setActive((current + 1) % Math.max(items.length, 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((current - 1 + items.length) % Math.max(items.length, 1)); }
    else if (e.key === "Enter") { e.preventDefault(); items[current]?.run(); }
    else if (e.key === "Escape") { e.preventDefault(); close(); }
  };

  const section = (title) => (
    <div className="px-3 pb-1 pt-3 text-[11px] font-medium uppercase tracking-wider text-faint">{title}</div>
  );

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[60] flex items-start justify-center bg-black/40 px-4 pt-[14vh] backdrop-blur-sm"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.12 }}
          onMouseDown={close}
        >
          <motion.div
            role="dialog"
            aria-label="Command palette"
            initial={{ opacity: 0, y: -8, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -8, scale: 0.98 }}
            transition={{ duration: 0.15 }}
            className="card w-full max-w-xl overflow-hidden shadow-pop"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 border-b border-line px-4">
              <Search size={17} className="shrink-0 text-faint" />
              <input
                ref={inputRef}
                autoFocus
                value={query}
                onChange={(e) => { setQuery(e.target.value); setActive(0); }}
                onKeyDown={onKeyDown}
                placeholder="Search problems or jump to…"
                className="h-14 flex-1 bg-transparent text-[15px] text-fg outline-none placeholder:text-faint"
              />
              <kbd className="rounded-md border border-line bg-subtle px-1.5 py-0.5 font-mono text-[11px] text-faint">esc</kbd>
            </div>

            <div className="max-h-[360px] overflow-y-auto p-1.5">
              {problems.length > 0 && section("Problems")}
              {items.map((it, i) => (
                <React.Fragment key={it.kind === "problem" ? it.p._id : it.a.label}>
                  {it.kind === "action" && i === problems.length && section("Go to")}
                  <button
                    onMouseMove={() => setActive(i)}
                    onClick={it.run}
                    className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition-colors ${
                      i === current ? "bg-hover text-fg" : "text-dim"}`}
                  >
                    {it.kind === "problem" ? (
                      <>
                        <FileCode2 size={16} className="shrink-0 text-faint" />
                        <span className="flex-1 truncate font-medium text-fg">{it.p.title}</span>
                        <span className={`badge ${DIFF_BADGE[it.p.difficulty] || "badge-neutral"}`}>{it.p.difficulty}</span>
                      </>
                    ) : (
                      <>
                        <it.a.icon size={16} className="shrink-0 text-faint" />
                        <span className="font-medium text-fg">{it.a.label}</span>
                        <span className="flex-1 truncate text-xs text-faint">{it.a.hint}</span>
                      </>
                    )}
                    {i === current && <CornerDownLeft size={14} className="shrink-0 text-faint" />}
                  </button>
                </React.Fragment>
              ))}
              {items.length === 0 && (
                <div className="px-3 py-10 text-center text-sm text-faint">No matches for “{query}”</div>
              )}
            </div>

            <div className="flex items-center gap-4 border-t border-line bg-subtle px-4 py-2 text-[11px] text-faint">
              <span><kbd className="font-mono">↑↓</kbd> navigate</span>
              <span><kbd className="font-mono">↵</kbd> open</span>
              <span className="ml-auto"><kbd className="font-mono">{isMac ? "⌘" : "Ctrl"} K</kbd> toggle</span>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
};

export default CommandPalette;
