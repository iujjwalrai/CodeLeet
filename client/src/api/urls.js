// Where the backend lives.
//
// Unset (the default): same site as the page. nginx forwards /api and /ws to
// the backend in Docker, and the Vite dev server proxies them in development.
// Set VITE_API_BASE_URL (and optionally VITE_API_BASE_URL_WS) when the API is
// on a different domain, e.g. a separate Render service.
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "";

// WebSocket URL for live run/submission updates.
export const wsUrl = () => {
  if (import.meta.env.VITE_API_BASE_URL_WS) return import.meta.env.VITE_API_BASE_URL_WS;

  const origin = API_BASE_URL || window.location.origin;
  return `${origin.replace(/^http/, "ws")}/ws`;
};
