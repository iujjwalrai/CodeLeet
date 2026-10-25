import React, { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence, useMotionValue, useSpring } from "framer-motion";
import { Menu, Moon, Search, Sun, X } from "lucide-react";
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../theme';
import CommandPalette from './CommandPalette';

const isMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);

// Same mark as the favicon in index.html; the border keeps it visible in dark mode
export const Logo = ({ small = false }) => (
  <span className="flex items-center gap-2">
    <svg viewBox="0 0 32 32" aria-hidden="true" className={small ? "h-6 w-6" : "h-7 w-7"}>
      <rect x="0.5" y="0.5" width="31" height="31" rx="7.5" fill="#0b1210" stroke="#3f3f46" />
      <path d="M8 10.5l5.5 5.5-5.5 5.5M16 22h8" fill="none" stroke="#10b981" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
    <span className={`font-semibold tracking-tight text-fg ${small ? "text-sm" : "text-[15px]"}`}>CodeLeet</span>
  </span>
);

export const ThemeToggle = ({ className = "" }) => {
  const { theme, toggle } = useTheme();
  return (
    <button
      onClick={toggle}
      className={`btn btn-ghost btn-icon ${className}`}
      aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
      title={theme === "dark" ? "Light mode" : "Dark mode"}
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={theme}
          initial={{ rotate: -90, opacity: 0 }}
          animate={{ rotate: 0, opacity: 1 }}
          exit={{ rotate: 90, opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="flex"
        >
          {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
        </motion.span>
      </AnimatePresence>
    </button>
  );
};

/* Nav link that leans toward the cursor while hovered */
const MagneticLink = ({ children, ...props }) => {
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const sx = useSpring(x, { stiffness: 350, damping: 20 });
  const sy = useSpring(y, { stiffness: 350, damping: 20 });
  return (
    <motion.button
      {...props}
      style={{ x: sx, y: sy }}
      onMouseMove={(e) => {
        const r = e.currentTarget.getBoundingClientRect();
        x.set((e.clientX - (r.left + r.width / 2)) * 0.22);
        y.set((e.clientY - (r.top + r.height / 2)) * 0.3);
      }}
      onMouseLeave={() => { x.set(0); y.set(0); }}
    >
      {children}
    </motion.button>
  );
};

/* Floating, glassy navbar. A highlight slides between links on hover
   and rests on the current page; the bar tightens once you scroll. Its
   border lights up where the cursor is near it. ⌘K opens the palette. */
const Navbar = () => {
  const naviagte = useNavigate();
  const { pathname } = useLocation();
  const { user } = useAuth();
  const [hovered, setHovered] = useState(null);
  const [scrolled, setScrolled] = useState(() => typeof window !== "undefined" && window.scrollY > 8);
  const [menuOpen, setMenuOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const navRef = useRef(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen(o => !o);
      }
    };
    // Spotlight: track the cursor relative to the bar; fade out with distance
    const onMove = (e) => {
      const el = navRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const dx = Math.max(r.left - e.clientX, 0, e.clientX - r.right);
      const dy = Math.max(r.top - e.clientY, 0, e.clientY - r.bottom);
      el.style.setProperty("--sx", `${e.clientX - r.left}px`);
      el.style.setProperty("--sy", `${e.clientY - r.top}px`);
      el.style.setProperty("--so", String(Math.max(0, 1 - Math.hypot(dx, dy) / 140)));
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointermove", onMove);
    };
  }, []);

  const links = [
    { label: "Problems", to: "/problems" },
    user && { label: "Dashboard", to: "/dashboard" },
  ].filter(Boolean);
  const active = links.findIndex(l => pathname.startsWith(l.to));
  const highlight = hovered ?? (active >= 0 ? active : null);

  const go = (to) => { setMenuOpen(false); naviagte(to); };

  const initials = user?.fullName?.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()
    || user?.username?.[0]?.toUpperCase() || "?";

  return (
    <header className="pointer-events-none sticky top-0 z-40 px-3 pt-3">
      <nav
        ref={navRef}
        className={`pointer-events-auto relative mx-auto flex items-center justify-between gap-3 rounded-2xl border border-line bg-surface/70 px-2.5 shadow-pop backdrop-blur-xl backdrop-saturate-150 transition-all duration-300 ${
          scrolled ? "h-14 max-w-4xl" : "h-16 max-w-6xl"}`}
      >
        <span aria-hidden="true" className="nav-spotlight" />
        <span aria-hidden="true" className="nav-spotlight-fill" />

        <div className="relative flex items-center gap-1">
          <button onClick={() => go("/")} aria-label="CodeLeet home" className="rounded-xl px-2 py-1.5">
            <Logo />
          </button>

          <span className="mx-2 hidden h-5 w-px bg-line sm:block" />

          <div className="hidden items-center sm:flex" onMouseLeave={() => setHovered(null)}>
            {links.map((l, i) => (
              <MagneticLink
                key={l.to}
                onMouseEnter={() => setHovered(i)}
                onClick={() => go(l.to)}
                className={`relative h-9 rounded-lg px-3.5 text-sm font-medium transition-colors ${
                  i === active ? "text-fg" : "text-dim hover:text-fg"}`}
              >
                {highlight === i && (
                  <motion.span
                    layoutId="nav-highlight"
                    className="absolute inset-0 rounded-lg bg-hover"
                    transition={{ type: "spring", stiffness: 500, damping: 38 }}
                  />
                )}
                <span className="relative">{l.label}</span>
                {i === active && (
                  <span className="absolute -bottom-[9px] left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-accent" />
                )}
              </MagneticLink>
            ))}
          </div>
        </div>

        {/* palette trigger */}
        <button
          onClick={() => setPaletteOpen(true)}
          className="relative hidden h-9 w-full max-w-[260px] items-center gap-2 rounded-xl border border-line bg-subtle/80 px-3 text-sm text-faint transition-colors hover:border-line-2 hover:text-dim md:flex"
        >
          <Search size={15} />
          <span className="flex-1 text-left">Search problems…</span>
          <kbd className="rounded-md border border-line bg-surface px-1.5 font-mono text-[11px]">{isMac ? "⌘" : "Ctrl"} K</kbd>
        </button>

        <div className="relative flex items-center gap-1">
          <button className="btn btn-ghost btn-icon rounded-xl md:hidden" onClick={() => setPaletteOpen(true)} aria-label="Search">
            <Search size={16} />
          </button>
          <ThemeToggle className="rounded-xl" />
          {
            !user ? (<button className="btn btn-primary btn-sm ml-1 rounded-xl" onClick={() => go("/login")}>
              Sign In
            </button>) : (<button
              onClick={() => go("/dashboard")}
              aria-label="Your account"
              title={user.fullName || user.username}
              className="ml-1 flex h-9 w-9 items-center justify-center rounded-full bg-accent-soft text-xs font-semibold text-accent ring-1 ring-accent/20 transition hover:ring-accent/50"
            >
              {initials}
            </button>)
          }
          <button
            className="btn btn-ghost btn-icon btn-sm rounded-xl sm:hidden"
            onClick={() => setMenuOpen(o => !o)}
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            aria-expanded={menuOpen}
          >
            {menuOpen ? <X size={16} /> : <Menu size={16} />}
          </button>
        </div>

        {/* phone menu */}
        <AnimatePresence>
          {menuOpen && (
            <motion.div
              initial={{ opacity: 0, y: -6, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -6, scale: 0.98 }}
              transition={{ duration: 0.15 }}
              className="absolute inset-x-0 top-full mt-2 rounded-2xl border border-line bg-surface p-2 shadow-pop sm:hidden"
            >
              {links.map((l, i) => (
                <button key={l.to} onClick={() => go(l.to)}
                  className={`flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-sm font-medium transition-colors hover:bg-hover ${
                    i === active ? "text-fg" : "text-dim"}`}>
                  {l.label}
                  {i === active && <span className="h-1.5 w-1.5 rounded-full bg-accent" />}
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </nav>
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
    </header>
  )
}

export default Navbar
