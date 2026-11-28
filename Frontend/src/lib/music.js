import { useEffect, useState } from "react";
import { apiFetch, readApiJson } from "./apiFetch";

const results = new Map();
const details = new Map();
const requests = new Map();
const pending = new Map();
let batchTimer;

async function fetchLibrary(path) {
  const response = await apiFetch(path);
  if (!response.ok) throw new Error("Music is unavailable. Try again.");
  const data = await readApiJson(response);
  const tracks = Array.isArray(data) ? data : data.tracks;
  for (const track of tracks) {
    details.set(track.id, { track, expires: Date.now() + 10 * 60 * 1000 });
    if (details.size > 256) details.delete(details.keys().next().value);
  }
  return data;
}

export function loadMusic(query = "", source = "library", category = "", page = 1, sort = "suggested") {
  const term = query.trim();
  if (source === "library") {
    const params = new URLSearchParams({ q: term, source, sort, page: String(page), ...(category && { category }) });
    return fetchLibrary(`/api/music?${params}`);
  }
  // Spotify identifiers are case-sensitive.
  const key = `${source}:${term}`;
  const existing = results.get(key);
  if (existing && existing.expires > Date.now()) return existing.promise;
  const promise = fetchLibrary(`/api/music?q=${encodeURIComponent(term)}&source=${source}`).then((data) =>
    Array.isArray(data) ? { tracks: data, scope: "catalog" } : data).catch((error) => {
    results.delete(key);
    throw error;
  });
  results.set(key, { expires: Date.now() + 5 * 60 * 1000, promise });
  if (results.size > 32) results.delete(results.keys().next().value);
  return promise;
}

function flushDetails() {
  batchTimer = undefined;
  const batch = [...pending].slice(0, 24);
  for (const [id] of batch) pending.delete(id);
  if (pending.size) batchTimer = setTimeout(flushDetails, 60);
  const ids = batch.map(([id]) => id);
  void fetchLibrary(`/api/music?ids=${encodeURIComponent(ids.join(","))}`).then((tracks) => {
    const byId = new Map(tracks.map((track) => [track.id, track]));
    for (const [id, complete] of batch) {
      const track = byId.get(id) ?? null;
      if (!track) details.set(id, { track, expires: Date.now() + 60000 });
      complete(track);
    }
  }).catch(() => {
    for (const [, complete] of batch) complete(null);
  });
}

function cached(id) {
  const entry = details.get(id);
  return entry?.expires > Date.now() ? entry : undefined;
}

function loadTrack(id) {
  const known = cached(id);
  if (known) return Promise.resolve(known.track);
  if (requests.has(id)) return requests.get(id);
  const request = new Promise((resolve) => {
    pending.set(id, resolve);
    batchTimer ??= setTimeout(flushDetails, 35);
  }).finally(() => requests.delete(id));
  requests.set(id, request);
  return request;
}

export function useMusicTrack(id, supplied) {
  const [snapshot, setSnapshot] = useState(null);
  useEffect(() => {
    if (!id || supplied) return;
    let active = true;
    void loadTrack(id).then((track) => { if (active) setSnapshot({ id, track }); });
    return () => { active = false; };
  }, [id, supplied]);
  return supplied ?? (snapshot && snapshot.id === id ? snapshot.track : cached(id)?.track);
}

export function noteTrackId(note) {
  if (note?.musicId) return note.musicId;
  const old = note?.albumId ? ["album", note.albumId] : ["track", note?.trackId];
  return /^[a-zA-Z0-9]{22}$/.test(old[1] ?? "") ? `spotify:${old[0]}:${old[1]}` : undefined;
}

export function defaultMusic(track, existing) {
  return { id: track.id, track, style: existing?.style ?? "card",
    ...(track.provider !== "spotify" && { start: 0, duration: Math.min(20, track.duration) }),
    x: existing?.x ?? 50, y: existing?.y ?? 72, size: existing?.size ?? 49 };
}

export function musicPayload(music) {
  const { id, style, start, duration, x, y, size } = music;
  return { id, style, start, duration, x, y, size };
}
