const allowed = new Set(["auth", "users", "posts", "notification", "messages", "groups", "polls", "media",
  "stories", "notes", "music", "admin"]);
const sampled = new WeakMap();
let queue = [];
let timer;

function flush() {
  clearTimeout(timer);
  timer = undefined;
  if (!queue.length) return;
  const samples = queue;
  queue = [];
  void fetch("/api/telemetry", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ samples }), keepalive: true,
  }).catch(() => {});
}

function record(surface, name, ms) {
  if (!Number.isFinite(ms) || ms < 0 || ms > 180000) return;
  queue.push({ surface, name, ms: Math.round(ms) });
  if (queue.length >= 16) flush();
  else timer ??= setTimeout(flush, 15_000);
}

export function sampleResponse(url, response, started) {
  const surface = url.pathname.split("/")[2];
  if (url.origin === location.origin && url.pathname.startsWith("/api/") && allowed.has(surface)
    && response.ok && Math.random() < .25) {
    sampled.set(response, { surface, started });
  }
}

export function isMeasuredResponse(response) { return sampled.has(response); }

export function finishResponse(response, parseStarted) {
  const sample = sampled.get(response);
  if (!sample) return;
  sampled.delete(response);
  record(sample.surface, "browser", performance.now() - sample.started);
  record(sample.surface, "decode", performance.now() - parseStarted);
}

if (typeof window !== "undefined") {
  window.addEventListener("pagehide", flush);
  window.addEventListener("load", () => {
    const timing = performance.getEntriesByType("navigation")[0];
    if (timing) record("page", "navigation", timing.domContentLoadedEventEnd);
  }, { once: true });
}
