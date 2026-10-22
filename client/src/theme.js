import { useSyncExternalStore } from "react";

/* Light/dark theme stored on <html data-theme>. index.html sets the
   initial value before paint; this hook reads and toggles it. No
   provider needed, so components work the same in tests. */

const KEY = "codeleet-theme";
const listeners = new Set();

const read = () =>
  (typeof document !== "undefined" && document.documentElement.dataset.theme) || "light";

export const setTheme = (theme) => {
  document.documentElement.dataset.theme = theme;
  try { localStorage.setItem(KEY, theme); } catch { /* storage unavailable */ }
  listeners.forEach((l) => l());
};

const subscribe = (l) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

export const useTheme = () => {
  const theme = useSyncExternalStore(subscribe, read, () => "light");
  const toggle = () => setTheme(theme === "dark" ? "light" : "dark");
  return { theme, toggle };
};
