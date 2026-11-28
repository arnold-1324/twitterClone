import { createHash } from "node:crypto";
import { performance } from "node:perf_hooks";
import { redisClient } from "../Redis.js";

export function createRateStore({ maxEntries = 20000, now = () => performance.now() } = {}) {
  const buckets = new Map();
  let nextSweep = 0;
  return (key, limit, windowMs, cost = 1) => {
    const time = now();
    if (time >= nextSweep) {
      for (const [id, bucket] of buckets) {
        if (bucket.expires <= time) buckets.delete(id);
      }
      nextSweep = time + 1000;
    }
    let bucket = buckets.get(key);
    if (!bucket || bucket.expires <= time) {
      if (!bucket && buckets.size >= maxEntries) return { allowed: false, remaining: 0, retry: 1 };
      bucket = { used: 0, expires: time + windowMs };
      buckets.set(key, bucket);
    }
    const allowed = bucket.used + cost <= limit;
    if (allowed) bucket.used += cost;
    return { allowed, remaining: limit - bucket.used, retry: Math.max(1, Math.ceil((bucket.expires - time) / 1000)) };
  };
}

const minute = 60000;
const takeIp = createRateStore({ maxEntries: 12000 });
const takeRoute = createRateStore();
export const takeSocket = createRateStore({ maxEntries: 12000 });

const chargeRedis = `
local used = tonumber(redis.call('GET', KEYS[1])) or 0
local ttl = redis.call('PTTL', KEYS[1])
local limit = tonumber(ARGV[1])
if ttl < 1 then
  used = 0
  ttl = tonumber(ARGV[2])
end
if used >= limit then return {0, 0, ttl} end
redis.call('SET', KEYS[1], used + 1, 'PX', ttl)
return {1, limit - used - 1, ttl}
`;

async function takeHttp(fallback, key, limit, windowMs) {
  if (redisClient.isReady) {
    const digest = createHash("sha256").update(key).digest("hex");
    try {
      const [allowed, remaining, ttl] = await redisClient.sendCommand([
        "EVAL", chargeRedis, "1", `social:rate:${digest}`, String(limit), String(windowMs),
      ], { abortSignal: AbortSignal.timeout(250) });
      return { allowed: Boolean(allowed), remaining, retry: Math.max(1, Math.ceil(ttl / 1000)) };
    } catch {
      // Keep enforcing local limits if Redis is starting, full or unavailable.
    }
  }
  return fallback(key, limit, windowMs);
}

function reply(res, budget, limit) {
  res.set("RateLimit-Limit", String(limit));
  res.set("RateLimit-Remaining", String(budget.remaining));
  res.set("RateLimit-Reset", String(budget.retry));
  if (budget.allowed) return false;
  res.set("Retry-After", String(budget.retry));
  res.status(429).json({ error: "Too many requests. Try again shortly." });
  return true;
}

export async function limitIp(req, res, next) {
  const budget = await takeHttp(takeIp, `ip:${req.ip}`, 360, minute);
  if (!budget.allowed) return reply(res, budget, 360);
  next();
}

export async function limitResource(req, res, next) {
  const path = req.route.path;
  const resource = `${req.baseUrl}${path === "/" ? "" : path}`;
  const read = req.method === "GET" || req.method === "HEAD";
  const method = read ? "GET" : req.method;
  const auth = req.baseUrl === "/api/auth";
  const uploads = req.is("multipart/form-data");
  const sensitive = new Map([["/login", 10], ["/signup", 8], ["/verify-email", 10],
    ["/forgot-password", 5], ["/reset-password/:resetToken", 8]]);
  let limit = read ? 100 : 30;
  let period = minute;
  if (auth && sensitive.has(path)) {
    limit = sensitive.get(path);
    period = 5 * minute;
  } else if (uploads) limit = 15;
  else if (resource === "/api/users/search") limit = 45;
  else if (resource.includes("/analytics")) limit = 8;

  const principal = req.user?._id ? `user:${req.user._id}` : `ip:${req.ip}`;
  const budget = await takeHttp(takeRoute, `${method}:${resource}:${principal}`, limit, period);
  if (reply(res, budget, limit)) return;

  if (auth && ["/login", "/forgot-password", "/verify-email"].includes(path)) {
    const identity = req.body?.[path === "/login" ? "username" : path === "/verify-email" ? "email" : "Femail"];
    if (typeof identity === "string" && identity.length <= 254) {
      const digest = createHash("sha256").update(identity.trim().toLowerCase()).digest("hex");
      const identityLimit = path === "/login" ? 15 : 8;
      const identityBudget = await takeHttp(takeRoute, `auth:${path}:${digest}`, identityLimit, period);
      if (reply(res, identityBudget, identityLimit)) return;
    }
  }
  next();
}

let uploadsInFlight = 0;
const uploadsByUser = new Map();
export function limitUpload(req, res, next) {
  if (!req.is("multipart/form-data")) return next();
  const key = String(req.user?._id ?? req.ip);
  const active = uploadsByUser.get(key) ?? 0;
  if (uploadsInFlight >= 8 || active >= 2) {
    return reply(res, { allowed: false, remaining: 0, retry: 2 }, active >= 2 ? 2 : 8);
  }
  uploadsByUser.set(key, active + 1);
  uploadsInFlight++;
  let released = false;
  const release = () => {
    if (released) return;
    released = true;
    uploadsInFlight--;
    const remaining = uploadsByUser.get(key) - 1;
    if (remaining) uploadsByUser.set(key, remaining);
    else uploadsByUser.delete(key);
  };
  res.once("finish", release);
  res.once("close", release);
  next();
}
