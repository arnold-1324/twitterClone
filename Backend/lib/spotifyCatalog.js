import { createReadCache } from "./readCache.js";
import featured from "./spotifyFeatured.json" with { type: "json" };

const cache = createReadCache({ maxEntries: 256, ttlMs: 10 * 60 * 1000 });
const byId = new Map(featured.map((track) => [track.id, track]));
const recent = new Map();
let token;
let pendingToken;

const spotifyPattern = /^spotify:(track|album):([A-Za-z0-9]{22})$/;
const linkPattern = /^https:\/\/open\.spotify\.com\/(?:intl-[a-z-]+\/)?(track|album)\/([A-Za-z0-9]{22})(?:[?#][^\s]*)?$/;

export const spotifyId = (value) => typeof value === "string" && spotifyPattern.test(value);

function spotifyLink(id) {
  const [, kind, entity] = spotifyPattern.exec(id);
  return `https://open.spotify.com/${kind}/${entity}`;
}

function present(track) {
  return { ...track, provider: "spotify", source: spotifyLink(track.id), accent: "#70dcad" };
}

async function json(url, options) {
  const response = await fetch(url, { ...options, signal: AbortSignal.timeout(5000) });
  if (!response.ok) throw Object.assign(new Error("Spotify is unavailable."), { status: response.status });
  return response.json();
}

function configured() {
  return Boolean(process.env.SPOTIFY_CLIENT_ID && process.env.SPOTIFY_CLIENT_SECRET);
}

function accessToken() {
  if (token?.expires > Date.now()) return Promise.resolve(token.value);
  if (pendingToken) return pendingToken;
  const credentials = Buffer.from(`${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`).toString("base64");
  pendingToken = json("https://accounts.spotify.com/api/token", {
    method: "POST", headers: { Authorization: `Basic ${credentials}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "client_credentials" }),
  }).then(({ access_token, expires_in }) => {
    if (!access_token) throw new Error("Spotify authorization failed.");
    token = { value: access_token, expires: Date.now() + Math.max(0, Number(expires_in) - 60) * 1000 };
    return access_token;
  }).finally(() => { pendingToken = undefined; });
  return pendingToken;
}

function artworkUrl(value) {
  if (!value) return undefined;
  let url;
  try { url = new URL(value); } catch { return undefined; }
  const allowed = ["i.scdn.co", "image-cdn-ak.spotifycdn.com", "image-cdn-fa.spotifycdn.com", "mosaic.scdn.co"];
  return url.protocol === "https:" && allowed.includes(url.hostname) && !url.port && !url.username && !url.password ? url.href : undefined;
}

function embeddedRecord(id, data) {
  return present({ ...(byId.get(id) ?? { id, artist: "Spotify" }), title: data.title || byId.get(id)?.title || "Spotify music",
    artwork: artworkUrl(data.thumbnail_url) });
}

function remember(track) {
  recent.delete(track.id);
  recent.set(track.id, { track, expires: Date.now() + 10 * 60 * 1000 });
  if (recent.size > 256) recent.delete(recent.keys().next().value);
  return track;
}

export async function resolveSpotify(id) {
  if (!spotifyId(id)) return null;
  const found = recent.get(id);
  if (found?.expires > Date.now()) return found.track;
  try {
    return await cache.read(`id:${id}`, async () => {
      const url = new URL("https://open.spotify.com/oembed");
      url.searchParams.set("url", spotifyLink(id));
      return remember(embeddedRecord(id, await json(url)));
    });
  } catch {
    return byId.has(id) ? present(byId.get(id)) : null;
  }
}

function words(value) {
  return value.normalize("NFKC").toLowerCase().replace(/[^\p{L}\p{M}\p{N}]+/gu, " ").trim();
}

function bundled(term) {
  const parts = words(term).split(" ").filter(Boolean);
  return featured.filter(({ title, artist }) => parts.every((part) => words(`${title} ${artist}`).includes(part)))
    .slice(0, 16).map(present);
}

async function liveSearch(term) {
  const url = new URL("https://api.spotify.com/v1/search");
  url.search = new URLSearchParams({ q: term, type: "track", limit: "10", market: process.env.SPOTIFY_MARKET || "IN" });
  const value = await accessToken();
  const result = await json(url, { headers: { Authorization: `Bearer ${value}` } });
  return (result.tracks?.items ?? []).filter(({ id, name }) => /^[A-Za-z0-9]{22}$/.test(id) && name).map((item) => remember(present({
    id: `spotify:track:${item.id}`, title: item.name, artist: item.artists?.map(({ name }) => name).filter(Boolean).join(", "),
    duration: Math.floor(item.duration_ms / 1000), artwork: artworkUrl(item.album?.images?.at(-1)?.url),
  })));
}

export async function searchSpotify(term = "") {
  const query = term.trim();
  const direct = linkPattern.exec(query);
  const id = direct ? `spotify:${direct[1]}:${direct[2]}` : spotifyId(query) ? query : null;
  if (id) {
    const track = await resolveSpotify(id);
    return { tracks: track ? [track] : [], scope: configured() ? "catalog" : "featured" };
  }
  if (query && configured()) {
    try { return { tracks: await cache.read(`search:${query.toLowerCase()}`, () => liveSearch(query)), scope: "catalog" }; }
    catch { /* Featured tracks remain searchable during a provider error. */ }
  }
  return { tracks: bundled(query), scope: configured() && !query ? "catalog" : "featured" };
}
