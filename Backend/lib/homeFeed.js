import { randomUUID } from "node:crypto";
import Post from "../models/post.model.js";
import PostView from "../models/postView.model.js";
import { createReadCache } from "./readCache.js";
import { beforeCursor } from "./cursorPage.js";

const half = 5;
const networkLimit = 15;
const snapshotLifetime = 15 * 60000;
const snapshots = new Map();
const trendCache = createReadCache({ maxEntries: 1, ttlMs: 45000 });

function fail(message) {
  return Object.assign(new Error(message), { status: 400 });
}

function hydrate(query) {
  return query.populate({ path: "postedBy", select: "username fullName profileImg", match: { isFrozen: { $ne: true } } })
    .populate("likes", "username profileImg");
}

async function rankedSnapshot() {
  const now = new Date();
  const candidates = await Post.aggregate([
    { $sort: { createdAt: -1, _id: -1 } },
    { $limit: 600 },
    { $project: {
      postedBy: 1, createdAt: 1, shareCount: 1,
      likes: { $cond: [{ $isArray: "$likes" }, { $size: "$likes" }, 0] },
      replies: { $cond: [{ $isArray: "$replies" }, { $size: "$replies" }, 0] },
    } },
  ]).option({ maxTimeMS: 3000 });
  const views = candidates.length ? await PostView.aggregate([
    { $match: { post: { $in: candidates.map(({ _id }) => _id) }, expiresAt: { $gt: now } } },
    { $group: { _id: "$post", count: { $sum: 1 } } },
  ]).option({ maxTimeMS: 3000 }) : [];
  const impressions = new Map(views.map(({ _id, count }) => [String(_id), count]));
  const scores = candidates.flatMap(({ _id, postedBy, likes, replies, shareCount, createdAt }) => {
    const activity = likes + 2 * replies + 3 * (shareCount ?? 0) + 0.25 * (impressions.get(String(_id)) ?? 0);
    const ageHours = Math.max(0, (now - createdAt) / 3600000);
    return activity > 0 ? [{ _id, postedBy, score: Math.log1p(activity) / (1 + ageHours / 96) }] : [];
  });
  scores.sort((left, right) => right.score - left.score);
  for (const [key, entry] of snapshots) {
    if (entry.expiresAt <= Date.now()) snapshots.delete(key);
  }
  const snapshot = { id: randomUUID(), scores, expiresAt: Date.now() + snapshotLifetime };
  snapshots.set(snapshot.id, snapshot);
  return snapshot;
}

function unpack(raw) {
  if (raw === undefined) return { offset: 0, networkCursor: undefined };
  const match = typeof raw === "string" && /^mix\.([a-f0-9-]{36})\.(\d{1,3})\.(end|\d{1,15}\.[a-f0-9]{24})$/.exec(raw);
  if (!match) throw fail("This feed page has expired. Refresh for a new mix.");
  const snapshot = snapshots.get(match[1]);
  const offset = Number(match[2]);
  if (!snapshot || snapshot.expiresAt <= Date.now() || offset > snapshot.scores.length) {
    throw fail("This feed page has expired. Refresh for a new mix.");
  }
  return { snapshot, offset, networkCursor: match[3] };
}

async function networkPage(ids, cursor) {
  if (cursor === "end") return [];
  return hydrate(Post.find({ postedBy: { $in: ids }, ...beforeCursor(cursor) })
    .sort({ createdAt: -1, _id: -1 }).limit(networkLimit).maxTimeMS(3000));
}

async function trendPage(snapshot, offset, network) {
  const window = [];
  let through = offset;
  for (; through < snapshot.scores.length && window.length < 20; through++) {
    const candidate = snapshot.scores[through];
    if (!network.has(String(candidate.postedBy))) window.push({ id: candidate._id, position: through });
  }
  if (!window.length) return { rows: [], through };
  const rows = await hydrate(Post.find({ _id: { $in: window.map(({ id }) => id) } }).maxTimeMS(3000));
  const byId = new Map(rows.filter(({ postedBy }) => postedBy).map((row) => [String(row._id), row]));
  return { rows: window.flatMap(({ id, position }) => {
    const post = byId.get(String(id));
    return post ? [{ post, position }] : [];
  }), through };
}

export async function homeFeed(account, before) {
  const ids = [account._id, ...new Map([...(account.following ?? []), ...(account.followers ?? [])]
    .filter((id) => String(id) !== String(account._id)).map((id) => [String(id), id])).values()];
  const network = new Set(ids.map(String));
  const state = unpack(before);
  const snapshotPromise = state.snapshot ?? trendCache.read("trending", rankedSnapshot);
  const [raw, snapshot, trending] = await Promise.all([
    networkPage(ids, state.networkCursor),
    snapshotPromise,
    Promise.resolve(snapshotPromise).then((value) => trendPage(value, state.offset, network)),
  ]);
  const related = raw.filter(({ postedBy }) => postedBy);
  const relatedCount = Math.min(related.length, half * 2 - Math.min(half, trending.rows.length));
  const trendCount = Math.min(trending.rows.length, half * 2 - Math.min(half, related.length));
  const posts = [];
  for (let i = 0; i < Math.max(relatedCount, trendCount); i++) {
    if (i < relatedCount) posts.push(related[i]);
    if (i < trendCount) posts.push(trending.rows[i].post);
  }
  const boundary = related.length > relatedCount ? related[relatedCount - 1] : raw.length === networkLimit ? raw.at(-1) : null;
  const networkCursor = boundary ? `${new Date(boundary.createdAt).getTime()}.${boundary._id}` : "end";
  const nextTrend = trendCount < trending.rows.length ? trending.rows[trendCount - 1].position + 1 : trending.through;
  const cursor = networkCursor !== "end" || nextTrend < snapshot.scores.length
    ? `mix.${snapshot.id}.${nextTrend}.${networkCursor}` : "";
  return { posts, cursor };
}
