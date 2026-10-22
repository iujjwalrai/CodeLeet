import React, { useEffect, useRef } from "react";

/* A soft radial glow that trails the cursor. Its colour comes from the
   nearest ancestor with data-glow="emerald|cyan|violet|amber" under the
   pointer. Render inside an `isolate` container so it sits behind content.
   Off on touch screens; no trailing animation with reduced motion. */
const CursorGlow = ({ subtle = false }) => {
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || window.matchMedia?.("(hover: none)")?.matches) return;
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;

    let tx = window.innerWidth / 2, ty = -300, x = tx, y = ty;
    let raf = 0, last;

    const place = () => {
      el.style.setProperty("--mx", `${x}px`);
      el.style.setProperty("--my", `${y}px`);
    };
    const setColor = (node) => {
      const name = node?.closest?.("[data-glow]")?.dataset.glow;
      if (name === last) return;
      last = name;
      el.style.setProperty("--glow-color", name ? `var(--glow-${name})` : "transparent");
    };
    // Ease toward the pointer so the glow trails slightly behind it
    const tick = () => {
      x += (tx - x) * 0.14;
      y += (ty - y) * 0.14;
      place();
      raf = Math.abs(tx - x) + Math.abs(ty - y) > 0.5 ? requestAnimationFrame(tick) : 0;
    };

    const onMove = (e) => {
      tx = e.clientX;
      ty = e.clientY;
      setColor(e.target);
      if (reduce) { x = tx; y = ty; place(); }
      else if (!raf) raf = requestAnimationFrame(tick);
    };
    // The page moves under a still cursor while scrolling
    const onScroll = () => setColor(document.elementFromPoint(tx, ty));
    const onLeave = () => setColor(null);

    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("scroll", onScroll, { passive: true });
    document.documentElement.addEventListener("pointerleave", onLeave);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("scroll", onScroll);
      document.documentElement.removeEventListener("pointerleave", onLeave);
    };
  }, []);

  return <div ref={ref} aria-hidden="true" className={`cursor-glow ${subtle ? "cursor-glow-subtle" : ""}`} />;
};

export default CursorGlow;
