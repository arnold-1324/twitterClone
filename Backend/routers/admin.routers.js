import express from "express";
import mongoose from "mongoose";
import { ListObjectsV2Command } from "@aws-sdk/client-s3";
import User from "../models/user.model.js";
import Post from "../models/post.model.js";
import Message from "../models/message.model.js";
import Conversation from "../models/conversation.model.js";
import { protectRoute } from "../middleware/protectRoute.js";
import { isAppOwner } from "../lib/adminAccess.js";
import { createReadCache } from "../lib/readCache.js";
import { performanceReport } from "../lib/requestMetrics.js";
import { musicBucket } from "../lib/musicStorage.js";
import { limitResource } from "../lib/rateLimits.js";

const router = express.Router();
const day = 86_400_000;
const cache = createReadCache({ maxEntries: 6, ttlMs: 60_000 });
const storageCache = createReadCache({ maxEntries: 2, ttlMs: 300_000 });
router.use(protectRoute, (req, res, next) => isAppOwner(req.user) ? next() : res.sendStatus(404));

function counts(model, date, start) {
  return model.aggregate([
    { $match: { [date]: { $gte: start } } },
    { $group: { _id: { $dateToString: { date: `$${date}`, format: "%Y-%m-%d", timezone: "UTC" } }, count: { $sum: 1 } } },
  ]).option({ maxTimeMS: 4000 });
}

router.get("/activity", limitResource, async (req, res, next) => {
  const days = Number(req.query.days ?? 30);
  if (![7, 30, 90].includes(days)) return res.status(400).json({ error: "Choose a valid time range." });
  try {
    const result = await cache.read(days, async () => {
      const today = Math.floor(Date.now() / day) * day;
      const start = new Date(today - (days - 1) * day);
      const models = { signups: [User, "createdAt"], posts: [Post, "createdAt"], messages: [Message, "createdAt"] };
      const entries = await Promise.all(Object.entries(models).map(async ([label, [model, date]]) =>
        [label, new Map((await counts(model, date, start)).map(({ _id, count }) => [_id, count]))]));
      const timeline = Array.from({ length: days }, (_, index) => {
        const date = new Date(start.getTime() + index * day).toISOString().slice(0, 10);
        return { date, ...Object.fromEntries(entries.map(([label, data]) => [label, data.get(date) ?? 0])) };
      });
      const [accounts, chats, authors, content] = await Promise.all([
        User.countDocuments().maxTimeMS(4000),
        Conversation.aggregate([{ $group: { _id: { $ifNull: ["$kind", "direct"] }, count: { $sum: 1 } } }]).option({ maxTimeMS: 4000 }),
        Message.distinct("sender", { createdAt: { $gte: start } }).maxTimeMS(4000),
        Post.aggregate([{ $group: { _id: { $ifNull: ["$kind", "post"] }, count: { $sum: 1 },
          likes: { $sum: { $size: { $cond: [{ $isArray: "$likes" }, "$likes", []] } } },
          replies: { $sum: { $size: { $cond: [{ $isArray: "$replies" }, "$replies", []] } } } } }]).option({ maxTimeMS: 4000 }),
      ]);
      return { accounts, chats, activeSenders: authors.length, content, timeline };
    });
    return res.json(result);
  } catch (error) { return next(error); }
});

router.get("/users", limitResource, async (req, res, next) => {
  const query = typeof req.query.q === "string" ? req.query.q.trim().slice(0, 80) : "";
  const rawPage = Number(req.query.page ?? 1);
  if (!Number.isSafeInteger(rawPage) || rawPage < 1 || rawPage > 1000) return res.status(400).json({ error: "Invalid page." });
  const literal = query.replace(/[.*+?${}()|[\]\\]/g, "\\$&");
  const filter = query ? { $or: [{ username: { $regex: literal, $options: "i" } },
    { fullName: { $regex: literal, $options: "i" } }] } : {};
  try {
    const users = await User.aggregate([
      { $match: filter }, { $sort: { createdAt: -1, _id: -1 } }, { $skip: (rawPage - 1) * 25 }, { $limit: 26 },
      { $project: { username: 1, fullName: 1, createdAt: 1, lastActiveAt: 1, isFrozen: 1,
        followers: { $size: { $cond: [{ $isArray: "$followers" }, "$followers", []] } } } },
    ]).option({ maxTimeMS: 4000 });
    const listed = users.slice(0, 25);
    const ids = listed.map(({ _id }) => _id);
    const since = new Date(Date.now() - 30 * day);
    const [messages, posts] = await Promise.all([[Message, "sender"], [Post, "postedBy"]].map(([model, field]) =>
      model.aggregate([{ $match: { [field]: { $in: ids }, createdAt: { $gte: since } } },
        { $group: { _id: `$${field}`, count: { $sum: 1 } } }]).option({ maxTimeMS: 4000 })));
    const sent = new Map(messages.map(({ _id, count }) => [String(_id), count]));
    const published = new Map(posts.map(({ _id, count }) => [String(_id), count]));
    return res.json({ users: listed.map((user) => ({ ...user, messages: sent.get(String(user._id)) ?? 0,
      posts: published.get(String(user._id)) ?? 0 })), hasMore: users.length > 25 });
  } catch (error) { return next(error); }
});

router.get("/chats", limitResource, async (req, res, next) => {
  const page = Number(req.query.page ?? 1);
  const kind = req.query.kind ?? "all";
  if (!["all", "direct", "group"].includes(kind) || !Number.isSafeInteger(page) || page < 1 || page > 1000) {
    return res.status(400).json({ error: "Choose a valid chat filter." });
  }
  const filter = kind === "all" ? {} : kind === "direct" ? { kind: { $in: ["direct", null] } } : { kind: "group" };
  try {
    const conversations = await Conversation.find(filter).sort({ "lastMessage.sentAt": -1, _id: -1 })
      .skip((page - 1) * 25).limit(26).select("kind participants lastMessage.sentAt").maxTimeMS(4000).lean();
    const listed = conversations.slice(0, 25);
    const totals = await Message.aggregate([
      { $match: { conversationId: { $in: listed.map(({ _id }) => _id) }, createdAt: { $gte: new Date(Date.now() - 30 * day) } } },
      { $group: { _id: "$conversationId", count: { $sum: 1 } } },
    ]).option({ maxTimeMS: 4000 });
    const counts = new Map(totals.map(({ _id, count }) => [String(_id), count]));
    return res.json({ chats: listed.map((chat) => ({ id: chat._id, kind: chat.kind ?? "direct",
      participants: chat.participants?.length ?? 0, lastActivity: chat.lastMessage?.sentAt,
      messages: counts.get(String(chat._id)) ?? 0 })), hasMore: conversations.length > 25 });
  } catch (error) { return next(error); }
});

function capacity(usage, variable) {
  const value = Number(process.env[variable]);
  const limit = Number.isSafeInteger(value) && value > 0 ? value : null;
  return { usage, limit, remaining: limit === null ? null : Math.max(0, limit - usage) };
}

async function bucketMetrics() {
  const storage = musicBucket();
  if (!storage) return { error: "S3 storage is unavailable." };
  let cursor;
  let usage = 0;
  const groups = new Map();
  const signal = AbortSignal.timeout(20_000);
  do {
    const page = await storage.client.send(new ListObjectsV2Command({ Bucket: storage.bucket, ContinuationToken: cursor }), { abortSignal: signal });
    for (const { Key, Size = 0 } of page.Contents ?? []) {
      usage += Size;
      const group = Key.startsWith("music/audio/") ? "Music audio" : Key.startsWith("music/artwork/") ? "Music artwork"
        : Key.startsWith("stickers/") ? "Stickers" : Key.startsWith("uploads/") ? "App uploads" : "Other files";
      const row = groups.get(group) ?? { name: group, bytes: 0, count: 0 };
      row.bytes += Size;
      row.count++;
      groups.set(group, row);
    }
    cursor = page.NextContinuationToken;
  } while (cursor);
  return { ...capacity(usage, "ADMIN_S3_CAPACITY_BYTES"), groups: [...groups.values()] };
}

async function databaseMetrics() {
  const db = mongoose.connection.db;
  const [stats, collections] = await Promise.all([
    db.command({ dbStats: 1, scale: 1, maxTimeMS: 4000 }),
    db.listCollections({}, { nameOnly: true }).toArray(),
  ]);
  const rows = [];
  for (let offset = 0; offset < collections.length; offset += 6) {
    const batch = await Promise.all(collections.slice(offset, offset + 6).map(async ({ name, type }) => {
      if (type === "view") return { name, view: true };
      try {
        const result = await db.command({ collStats: name, scale: 1, maxTimeMS: 3000 });
        return { name, documents: result.count, data: result.size, indexes: result.totalIndexSize, allocated: result.storageSize };
      } catch { return { name, unavailable: true }; }
    }));
    rows.push(...batch);
  }
  return { ...capacity(stats.dataSize + stats.indexSize, "ADMIN_DB_CAPACITY_BYTES"), data: stats.dataSize,
    indexes: stats.indexSize, allocated: stats.storageSize, collections: rows.sort((a, b) => (b.data ?? 0) - (a.data ?? 0)) };
}

router.get("/storage", limitResource, async (_req, res, next) => {
  try {
    const result = await storageCache.read("storage", async () => {
      const [s3, database] = await Promise.all([
        bucketMetrics().catch(() => ({ error: "Could not measure S3 usage." })),
        databaseMetrics().catch(() => ({ error: "Could not measure MongoDB usage." })),
      ]);
      return { s3, database, measuredAt: new Date() };
    });
    return res.json(result);
  } catch (error) { return next(error); }
});

router.get("/performance", limitResource, async (req, res, next) => {
  const hours = Number(req.query.hours ?? 6);
  if (![1, 6, 24].includes(hours)) return res.status(400).json({ error: "Choose a valid performance time range." });
  try { return res.json(await performanceReport(hours, req.requestAbortSignal)); }
  catch (error) { if (!req.requestAbortSignal?.aborted) return next(error); }
});

export default router;
