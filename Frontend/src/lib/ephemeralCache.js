import { apiFetch, readApiJson } from "./apiFetch";

export const notesPath = "/api/notes";
export const noteProfilePath = (id) => `${notesPath}/profile/${encodeURIComponent(id)}`;
export const storyFeedPath = "/api/stories/feed";
export const storyProfilePath = (username) => `/api/stories/profile/${encodeURIComponent(username)}`;

const lifetime = 30000;
const maxEntries = 64;
const entries = new Map();
const empty = Object.freeze({});

export function ephemeralEntry(viewer, path) {
  if (!viewer || !path) return null;
  const key = `${viewer}:${path}`;
  let entry = entries.get(key);
  if (!entry) {
    entry = { viewer, path, snapshot: empty, listeners: new Set(), freshUntil: 0 };
    entries.set(key, entry);
  }
  entries.delete(key);
  entries.set(key, entry);
  for (const [key, candidate] of entries) {
    if (entries.size <= maxEntries) break;
    if (candidate === entry || candidate.listeners.size || candidate.request) continue;
    entries.delete(key);
  }
  return entry;
}

function publish(entry, snapshot) {
  entry.snapshot = snapshot;
  for (const listener of entry.listeners) listener();
}

function invalidate(entry) {
  entry.request?.abort();
  entry.request = null;
  entry.freshUntil = 0;
}

export function clearEphemeralCache(viewer, match = () => true) {
  for (const [key, entry] of entries) {
    if (entry.viewer !== viewer || !match(entry.path)) continue;
    invalidate(entry);
    if (entry.listeners.size) publish(entry, empty);
    else entries.delete(key);
  }
}

export function invalidateStories(viewer, username) {
  const profile = storyProfilePath(username);
  clearEphemeralCache(viewer, (path) => path === storyFeedPath || path === profile
    || path === `${profile}/status` || path.startsWith(`${profile}?`));
}

export function updateEphemeral(entry, change, { keepFresh = false } = {}) {
  if (!entry) return;
  if (!keepFresh) invalidate(entry);
  publish(entry, { data: change(entry.snapshot.data) });
}

export function markStorySeen(viewer, username, id, wasUnseen) {
  const profile = storyProfilePath(username);
  for (const entry of [...entries.values()]) {
    if (entry.viewer !== viewer || !entry.snapshot.data) continue;
    if (entry.path === profile || entry.path.startsWith(`${profile}?`)) {
      updateEphemeral(entry, (data) => ({
        ...data, stories: data.stories.map((story) => story._id === id ? { ...story, seen: true } : story),
      }), { keepFresh: true });
    } else if (entry.path === storyFeedPath && wasUnseen) {
      updateEphemeral(entry, (data) => data.map((row) => {
        if (row.author.username !== username || !row.unseenCount) return row;
        return { ...row, unseen: row.unseenCount > 1, unseenCount: row.unseenCount - 1,
          preview: row.preview?._id === id ? undefined : row.preview };
      }).sort((a, b) => Number(Boolean(b.unseen)) - Number(Boolean(a.unseen)) || b.last.localeCompare(a.last)), { keepFresh: true });
    } else if (entry.path === `${profile}/status` && wasUnseen) {
      clearEphemeralCache(viewer, (path) => path === entry.path);
    }
  }
}

export function loadEphemeral(entry, { force = false } = {}) {
  if (!entry) return Promise.resolve();
  if (entry.request) return entry.promise;
  if (!force && entry.freshUntil > Date.now()) return Promise.resolve(entry.snapshot.data);

  const request = new AbortController();
  entry.request = request;
  entry.promise = (async () => {
    try {
      const response = await apiFetch(entry.path, { signal: request.signal });
      const data = await readApiJson(response);
      if (!response.ok) throw Object.assign(new Error(data?.error || "Could not refresh."), { status: response.status });
      if (request.signal.aborted) return;
      entry.freshUntil = Date.now() + lifetime;
      publish(entry, { data });
      return data;
    } catch (error) {
      if (request.signal.aborted) return;
      entry.freshUntil = Date.now() + lifetime;
      const canKeepData = !error.status || error.status === 429 || error.status >= 500;
      publish(entry, { data: canKeepData ? entry.snapshot.data : undefined, error: error.message });
      throw error;
    } finally {
      if (entry.request === request) entry.request = null;
    }
  })();
  return entry.promise;
}

export function prefetchEphemeral(viewer, path) {
  return loadEphemeral(ephemeralEntry(viewer, path)).catch(() => undefined);
}

export function storyProfileData(data) {
  if (!data) return data;
  const now = Date.now();
  return { ...data, stories: data.stories.filter(({ expiresAt }) => Date.parse(expiresAt) > now) };
}
