import { createReadCache } from "./readCache.js";
import { resolveSpotify, spotifyId } from "./spotifyCatalog.js";
import { getLibraryTracks, isLibraryId } from "./hostedMusic.js";

const endpoint = "https://commons.wikimedia.org/w/api.php";
const catalogCache = createReadCache({ maxEntries: 256, ttlMs: 10 * 60 * 1000 });
const featured = [84700139, 146642997, 41078226, 64733397, 84701318, 41395302, 16296859, 84701327, 40799767, 84701335];
const colors = ["#71d7b9", "#8ba9fb", "#f2a674", "#c89cf3", "#edcd70"];
const playable = new Set(["audio/mpeg", "audio/wav", "audio/x-wav", "audio/ogg", "application/ogg", "audio/flac", "audio/x-flac", "audio/opus", "audio/mp4"]);
const trackPattern = /^commons:[1-9]\d{0,10}$/;

const validCommonsId = (id) => typeof id === "string" && trackPattern.test(id);
export const validTrackId = (id) => validCommonsId(id) || spotifyId(id) || isLibraryId(id);

function simplify(value) {
  return typeof value === "string" ? value.replace(/<[^>]*>/g, " ").replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&").replace(/&#39;|&apos;/gi, "'").replace(/&quot;/gi, '"').replace(/\s+/g, " ").trim().slice(0, 180) : "";
}

function mediaUrl(value) {
  if (!value) return undefined;
  let url;
  try { url = new URL(value); } catch { return undefined; }
  if (url.protocol !== "https:" || url.hostname !== "upload.wikimedia.org" || url.port || url.username || url.password) return undefined;
  url.search = "";
  url.hash = "";
  return url.href;
}

function presentTrack(page) {
  const file = page.imageinfo?.[0];
  const url = mediaUrl(file?.url);
  if (!url || !playable.has(file.mime)) return null;
  const name = page.title?.replace(/^File:/, "").replace(/\.[a-z\d]{2,5}$/i, "");
  if (!name || /^(ta|en|de|fr|hi|es|it|pt)-/i.test(name) || /^LL-Q\d+ /i.test(name)) return null;
  const info = file.extmetadata ?? {};
  const license = simplify(info.LicenseShortName?.value);
  if (!/^(CC0(?: 1\.0)?|CC BY [1-4]\.\d|Public domain(?: mark)?)$/i.test(license)) return null;
  const duration = Math.floor(Number(file.metadata?.find(({ name }) => ["length", "playtime_seconds"].includes(name))?.value));
  if (!Number.isFinite(duration) || duration < 5) return null;
  const artwork = mediaUrl(file.thumburl);
  return {
    id: `commons:${page.pageid}`, title: simplify(info.ObjectName?.value) || name,
    artist: simplify(info.Artist?.value) || "Wikimedia Commons contributor",
    url, artwork: artwork && /\.(png|jpe?g|webp)$/i.test(artwork) ? artwork : undefined,
    duration, license, source: `https://commons.wikimedia.org/?curid=${page.pageid}`,
    accent: colors[page.pageid % colors.length],
  };
}

async function fetchTracks(filters) {
  const query = new URLSearchParams({
    action: "query", format: "json", formatversion: "2",
    prop: "imageinfo", iiprop: "url|mime|extmetadata|metadata",
    iiextmetadatafilter: "LicenseShortName|Artist|ObjectName", iiurlwidth: "180", ...filters,
  });
  let response;
  try {
    response = await fetch(`${endpoint}?${query}`, {
      signal: AbortSignal.timeout(7000),
      headers: { "User-Agent": "SocialAppMusic/1.0 (+https://twitterclone-production-67bad283.up.railway.app/)" },
    });
    if (!response.ok) throw new Error("Wikimedia returned an error.");
    const payload = await response.json();
    if (payload.error) throw new Error("Wikimedia returned an error.");
    return (payload.query?.pages ?? []).sort((a, b) => (a.index ?? 0) - (b.index ?? 0)).map(presentTrack).filter(Boolean);
  } catch {
    throw Object.assign(new Error("The music library is temporarily unavailable. Try again."), { status: 503 });
  }
}

async function commonsTracks(ids) {
  const numbers = [...new Set(ids.filter(validCommonsId).map((id) => id.slice(8)))];
  if (!numbers.length) return [];
  const key = numbers.slice().sort().join("|");
  const listed = await catalogCache.read(`tracks:${key}`, () => fetchTracks({ pageids: key }));
  const byId = new Map(listed.map((track) => [track.id, track]));
  return numbers.map((id) => byId.get(`commons:${id}`)).filter(Boolean);
}

export async function getTracks(ids) {
  const unique = [...new Set(ids)];
  const [commons, spotify, library] = await Promise.all([
    commonsTracks(unique).catch((error) => {
      if (unique.every(validCommonsId)) throw error;
      return [];
    }),
    Promise.all(unique.filter(spotifyId).map(resolveSpotify)),
    getLibraryTracks(unique.filter(isLibraryId)),
  ]);
  const byId = new Map([...commons, ...spotify.filter(Boolean), ...library].map((track) => [track.id, track]));
  return unique.flatMap((id) => byId.has(id) ? [byId.get(id)] : []);
}

export async function getTrack(id) {
  const [track] = await getTracks([id]);
  return track;
}

export async function searchTracks(term) {
  if (!term) return commonsTracks(featured.map((page) => `commons:${page}`));
  const cleaned = term.replace(/[\u0000-\u001f:\\"|]/g, " ").trim().slice(0, 80);
  if (!cleaned) return [];
  return catalogCache.read(`search:${cleaned.toLowerCase()}`, () => fetchTracks({
    generator: "search", gsrnamespace: "6", gsrlimit: "40", gsrsearch: `${cleaned} filetype:audio`,
  }));
}
