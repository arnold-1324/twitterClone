import { createHmac } from "node:crypto";
import { LibraryTrack, MusicEvent } from "../models/musicLibrary.model.js";
import { createReadCache } from "./readCache.js";

const dayMs = 86_400_000;
const retention = 30 * dayMs;
const pageSize = 24;
const clipStep = 5;
const cutoff = () => new Date(Date.now() - retention);
const detailCache = createReadCache({ maxEntries: 256, ttlMs: 60_000 });
const trendingCache = createReadCache({ maxEntries: 2, ttlMs: 60_000 });
const objectCache = createReadCache({ maxEntries: 256, ttlMs: 120_000 });
const pattern = /^library:[a-f0-9]{32}$/;
export const isLibraryId = (id) => typeof id === "string" && pattern.test(id);
export const musicWords = (text) => text.normalize("NFKC").toLowerCase().replace(/[^\p{L}\p{N}\p{M}]+/gu, " ").trim();

function present({ _id, title, artist, album, composer, year, genre, artworkKey, category, tags, duration, license, licenseUrl, source }, trending = []) {
  return { id: _id, title, artist, album, composer, year, genre, category, tags, duration, license, licenseUrl, source, trending,
    artwork: artworkKey ? `/api/music/artwork/${artworkKey.match(/[a-f0-9]{64}/)?.[0]}.webp` : undefined,
    provider: "library", url: `/api/music/audio/${_id.slice(8)}`, accent: "#71d7b9" };
}

async function clipTrends(tracks) {
  if (!tracks.length) return new Map();
  const rows = await MusicEvent.aggregate([
    { $match: { kind: "clip", tracks: { $in: tracks.map(({ _id }) => _id) }, day: { $gte: cutoff() } } },
    { $set: {
      bins: { $range: [{ $toInt: { $ceil: { $divide: ["$start", clipStep] } } },
        { $toInt: { $ceil: { $divide: [{ $add: ["$start", "$duration"] }, clipStep] } } }] },
    } },
    { $unwind: "$bins" },
    { $group: { _id: { track: { $arrayElemAt: ["$tracks", 0] }, bin: "$bins", user: "$user" } } },
    { $group: { _id: { track: "$_id.track", bin: "$_id.bin" }, listeners: { $sum: 1 } } },
    { $match: { listeners: { $gte: 3 } } },
    { $sort: { "_id.track": 1, listeners: -1, "_id.bin": 1 } },
    { $group: { _id: "$_id.track", bins: { $firstN: { n: 6, input: "$_id.bin" } } } },
  ]).option({ maxTimeMS: 2500 });
  const durations = new Map(tracks.map(({ _id, duration }) => [_id, duration]));
  return new Map(rows.map(({ _id, bins }) => [_id, bins.sort((a, b) => a - b).map((bin) => ({
    start: bin * clipStep, end: Math.min((bin + 1) * clipStep, durations.get(_id)),
  }))]));
}

async function withTrends(tracks) {
  const sections = await clipTrends(tracks).catch(() => new Map());
  return tracks.map((track) => present(track, sections.get(track._id)));
}

export async function getLibraryTracks(ids) {
  if (!ids.length) return [];
  const key = [...ids].sort().join("|");
  return detailCache.read(key, async () => withTrends(await LibraryTrack.find({ _id: { $in: ids } }).lean()));
}

export function invalidateMusicCatalog() {
  detailCache.clear();
  objectCache.clear();
}

export function getLibraryAudio(id) {
  return objectCache.read(id, () => LibraryTrack.findById(id).select("objectKey bytes").lean());
}

function popularTrackIds() {
  return trendingCache.read("tracks", async () => {
    const rows = await MusicEvent.aggregate([
      { $match: { kind: "clip", day: { $gte: cutoff() } } },
      { $group: { _id: { track: { $arrayElemAt: ["$tracks", 0] }, user: "$user" } } },
      { $group: { _id: "$_id.track", listeners: { $sum: 1 } } },
      { $match: { listeners: { $gte: 3 } } },
      { $sort: { listeners: -1, _id: 1 } }, { $limit: 300 },
    ]).option({ maxTimeMS: 2500 });
    return rows.map(({ _id }) => _id);
  });
}

export async function searchLibrary({ query, category, page, user, sort }) {
  const terms = musicWords(query).split(" ").filter(Boolean).slice(0, 8);
  const filter = { ...(category && { category }) };
  if (terms.length) filter.$and = terms.map((term) => ({ searchText: { $regex: term } }));
  const skip = (page - 1) * pageSize;
  let rows;
  if (sort === "trending") {
    const ids = await popularTrackIds();
    const tracks = await LibraryTrack.find({ ...filter, _id: { $in: ids } }).maxTimeMS(3000).lean();
    const byId = new Map(tracks.map((track) => [track._id, track]));
    rows = ids.flatMap((id) => byId.has(id) ? [byId.get(id)] : []).slice(skip, skip + pageSize + 1);
  } else if (!terms.length && user) {
    const activity = await MusicEvent.find({ user, day: { $gte: cutoff() } }).sort({ day: -1 }).limit(120).select("tracks").lean();
    const counts = new Map();
    for (const event of activity) for (const id of event.tracks) counts.set(id, (counts.get(id) ?? 0) + 1);
    rows = await LibraryTrack.aggregate([
      { $match: filter },
      { $set: { affinity: { $switch: { branches: [
        ...[...counts].sort((a, b) => b[1] - a[1]).slice(0, 60).map(([id, score]) => ({
          case: { $eq: ["$_id", id] }, then: score,
        })),
        { case: false, then: 0 },
      ], default: 0 } } } },
      { $sort: { affinity: -1, updatedAt: -1, _id: 1 } },
      { $skip: skip }, { $limit: pageSize + 1 },
    ]).option({ maxTimeMS: 3000 });
  } else {
    rows = await LibraryTrack.find(filter).sort({ title: 1, _id: 1 }).skip(skip).limit(pageSize + 1).maxTimeMS(3000).lean();
  }
  return { tracks: await withTrends(rows.slice(0, pageSize)), scope: "library", hasMore: rows.length > pageSize };
}

async function record({ user, kind, key, ...fields }) {
  const day = new Date(Math.floor(Date.now() / dayMs) * dayMs);
  const id = createHmac("sha256", process.env.JWT_SECRET)
    .update(JSON.stringify([String(user), kind, key, day.getTime()])).digest("hex");
  await MusicEvent.updateOne({ _id: id }, {
    $setOnInsert: { user, kind, day, expiresAt: new Date(day.getTime() + retention), ...fields },
  }, { upsert: true });
}

export function recordMusicSearch(user, query, tracks) {
  const key = musicWords(query);
  if (!key) return;
  void record({ user, kind: "search", key, tracks: tracks.slice(0, 4).map(({ id }) => id) })
    .catch((error) => console.warn("Music search signal:", error.name));
}

export function recordMusicClip(user, music, surface) {
  if (!isLibraryId(music?.id) || !Number.isFinite(music.start) || !Number.isFinite(music.duration)) return;
  const start = Math.round(music.start);
  const duration = Math.round(music.duration);
  void record({ user, kind: "clip", key: [music.id, start, duration, surface], tracks: [music.id], start, duration, surface })
    .catch((error) => console.warn("Music clip signal:", error.name));
}
