import { AsyncLocalStorage } from "node:async_hooks";
import { performance } from "node:perf_hooks";
import mongoose from "mongoose";

const context = new AsyncLocalStorage();
const bounds = [5, 10, 20, 35, 50, 75, 100, 150, 220, 330, 500, 750, 1000, 1500, 2500, 4000, 7500, 15000, 30000, 60000, 120000];
const surfaces = new Set(["auth", "users", "posts", "notification", "messages", "groups", "polls", "media",
  "stories", "notes", "music", "admin", "page"]);
const durations = ["backend", "database", "objectStorage", "browser", "decode", "navigation"];
const minute = 60_000;
const retention = 48 * 60 * minute;
const batchLimit = 16 * 1024;
const interval = () => Math.floor(Date.now() / minute) * minute;
const collection = () => mongoose.connection.db.collection("requestmetrics");
let current = interval();
let rows = new Map();

function blank() {
  return { buckets: Array(bounds.length + 1).fill(0), count: 0, sum: 0 };
}

function measure(metrics, name, duration) {
  if (!Number.isFinite(duration) || duration < 0 || duration > 180000) return;
  const data = metrics[name] ??= blank();
  const bucket = bounds.findIndex((bound) => duration <= bound);
  data.buckets[bucket < 0 ? bounds.length : bucket]++;
  data.count++;
  data.sum += duration;
}

async function flush() {
  const now = interval();
  if (now === current) return;
  const time = current;
  const batch = rows;
  current = now;
  rows = new Map();
  if (!batch.size || mongoose.connection.readyState !== 1) return;
  try {
    const stored = [];
    let bytes = 0;
    let omitted = 0;
    // Preserve the busiest endpoints when a busy minute exceeds its storage budget.
    for (const entry of [...batch.values()].sort((a, b) => b.requests - a.requests)) {
      const size = Buffer.byteLength(JSON.stringify(entry));
      if (bytes + size > batchLimit) {
        omitted++;
        continue;
      }
      bytes += size;
      stored.push(entry);
    }
    await collection().insertOne({ time: new Date(time), expiresAt: new Date(time + retention), rows: stored, omitted });
  } catch (error) {
    console.warn("Could not store request metrics:", error.name);
  }
}

function rowFor(surface, route, method) {
  if (interval() !== current) void flush();
  const key = `${surface}:${route}:${method}`;
  if (!rows.has(key) && rows.size >= 160) return;
  if (!rows.has(key)) rows.set(key, { surface, route, method, requests: 0, errors: 0, clientErrors: 0, cancelled: 0, metrics: {} });
  return rows.get(key);
}

export function requestMetrics(req, res, next) {
  const segment = req.path.split("/")[1];
  if (segment === "telemetry") return next();
  const surface = surfaces.has(segment) ? segment : "other";
  const controller = new AbortController();
  req.requestAbortSignal = controller.signal;
  const detail = { started: performance.now(), database: 0, commands: 0, objectStorage: 0, objects: 0 };
  const writeHead = res.writeHead;
  res.writeHead = function (...args) {
    if (!res.headersSent) res.setHeader("Server-Timing",
      `app;dur=${(performance.now() - detail.started).toFixed(1)}, db;dur=${detail.database.toFixed(1)}, s3;dur=${detail.objectStorage.toFixed(1)}`);
    return writeHead.apply(this, args);
  };
  res.once("close", () => {
    const cancelled = !res.writableFinished;
    if (cancelled) controller.abort();
    const route = typeof req.route?.path === "string" ? req.route.path : "";
    const method = ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE"].includes(req.method) ? req.method : "OTHER";
    const row = rowFor(surface, route, method);
    if (!row) return;
    row.requests++;
    if (cancelled) {
      row.cancelled++;
      return;
    }
    if (res.statusCode >= 500) row.errors++;
    else if (res.statusCode >= 400) row.clientErrors++;
    measure(row.metrics, "backend", performance.now() - detail.started);
    if (detail.commands) measure(row.metrics, "database", detail.database);
    if (detail.objects) measure(row.metrics, "objectStorage", detail.objectStorage);
  });
  return context.run(detail, next);
}

export function monitorMongo(client) {
  const pending = new Map();
  const key = (event) => `${event.address}:${event.requestId}`;
  client.on("commandStarted", (event) => {
    const detail = context.getStore();
    if (detail && pending.size < 1000) pending.set(key(event), detail);
  });
  function finish(event) {
    const id = key(event);
    const detail = pending.get(id);
    if (!detail) return;
    pending.delete(id);
    detail.commands++;
    detail.database += event.duration;
  }
  client.on("commandSucceeded", finish);
  client.on("commandFailed", finish);
  client.on("close", () => pending.clear());
}

export async function measureObjectStorage(work) {
  const detail = context.getStore();
  if (!detail) return work();
  const started = performance.now();
  try { return await work(); }
  finally {
    detail.objects++;
    detail.objectStorage += performance.now() - started;
  }
}

export function recordBrowserTiming(samples) {
  if (!Array.isArray(samples) || samples.length === 0 || samples.length > 16) return false;
  if (!samples.every((sample) => sample && surfaces.has(sample.surface) &&
    ["browser", "decode", "navigation"].includes(sample.name) && Number.isFinite(sample.ms) && sample.ms >= 0 && sample.ms <= 180000)) return false;
  for (const { surface, name, ms } of samples) {
    const row = rowFor(surface, "", "BROWSER");
    if (row) measure(row.metrics, name, ms);
  }
  return true;
}

function summary(data) {
  if (!data?.count) return { count: 0, p50: null, p95: null, p99: null, mean: null };
  const percentile = (fraction) => {
    let cumulative = 0;
    for (const [index, count] of data.buckets.entries()) {
      cumulative += count;
      if (cumulative >= Math.ceil(fraction * data.count)) return bounds[index] ?? 180000;
    }
    return null;
  };
  return { count: data.count, mean: Math.round(data.sum / data.count),
    p50: percentile(.5), p95: percentile(.95), p99: percentile(.99) };
}

export async function performanceReport(hours, signal) {
  const from = Date.now() - hours * 60 * minute;
  const cursor = collection().find({ time: { $gte: new Date(from) } }, { signal, sort: { time: 1 }, limit: hours * 60 + 2, maxTimeMS: 5000 });
  const totals = new Map();
  const graph = new Map();
  function merge(entry, time) {
    const date = Math.floor(time / (15 * minute)) * 15 * minute;
    const point = graph.get(date) ?? { time: new Date(date), requests: 0, errors: 0, cancelled: 0, metrics: {} };
    const key = `${entry.surface}:${entry.route}:${entry.method}`;
    const total = totals.get(key) ?? { surface: entry.surface, route: entry.route, method: entry.method,
      requests: 0, errors: 0, clientErrors: 0, cancelled: 0, metrics: {} };
    for (const target of [point, total]) {
      target.requests += entry.requests;
      target.errors += entry.errors;
      target.cancelled += entry.cancelled;
      if (target === total) target.clientErrors += entry.clientErrors ?? 0;
      for (const name of durations) {
        const from = entry.metrics[name];
        if (!from) continue;
        const to = target.metrics[name] ??= blank();
        to.count += from.count;
        to.sum += from.sum;
        from.buckets.forEach((value, index) => { to.buckets[index] += value; });
      }
    }
    totals.set(key, total);
    graph.set(date, point);
  }
  let omitted = 0;
  for await (const { time, rows, omitted: dropped } of cursor) {
    omitted += dropped ?? 0;
    for (const entry of rows) merge(entry, time.getTime());
  }
  for (const entry of rows.values()) merge(entry, current);
  function present({ metrics, ...values }) {
    return { ...values, metrics: Object.fromEntries(durations.map((name) => [name, summary(metrics[name])])) };
  }
  return { hours, omitted, rows: [...totals.values()].map(present).sort((a, b) => b.requests - a.requests), trend: [...graph.values()].map(present) };
}

export async function startRequestMetrics() {
  try {
    await Promise.all([collection().createIndex({ time: 1 }), collection().createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 })]);
  } catch (error) { console.warn("Request metrics indexes:", error.name); }
  setInterval(() => void flush(), 5000).unref();
}
