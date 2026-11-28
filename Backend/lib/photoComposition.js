import { getTrack } from "./musicCatalog.js";

const fonts = new Set([
  "dm-sans", "nunito", "fraunces", "source-serif", "caveat", "ibm-plex", "inter", "work-sans", "barlow-condensed",
  "oswald", "archivo-black", "space-mono", "playfair-display", "cormorant-garamond", "bebas-neue", "comfortaa",
  "raleway", "quicksand", "cinzel", "permanent-marker",
]);
const stickers = new Set(["✨", "💛", "🔥", "🌈", "🌙", "🪩", "🌸", "🎉", "🎶", "☕", "🫶", "🌊", "⚽", "🦋", "💫", "📍"]);
const colorPattern = /^#[0-9a-f]{6}$/i;
const within = (value, min, max) => typeof value === "number" && Number.isFinite(value) && value >= min && value <= max;
const invalid = (message) => Object.assign(new Error(message), { status: 400 });

function readJson(value, label) {
  if (!value) return undefined;
  if (typeof value !== "string") return value;
  if (value.length > 7000) throw invalid(label);
  try { return JSON.parse(value); } catch { throw invalid(label); }
}

export function readClip(track, start, duration) {
  if (!within(start, 0, track.duration - 5) || !within(duration, 5, 30) || start + duration > track.duration) {
    throw invalid("Choose a valid track and clip.");
  }
  return { start, duration };
}

export async function readMusic(value) {
  const label = "Choose a valid track and clip.";
  const data = readJson(value, label);
  if (data === undefined || data === null) return undefined;
  const track = await getTrack(data.id);
  const { style, start, duration, x, y, size } = data;
  if (!track || !["audio", "card", "record"].includes(style)
    || !within(x, 0, 100) || !within(y, 0, 100) || !within(size, 12, 80)) throw invalid(label);
  if (track.provider === "spotify") return { id: track.id, style, x, y, size };
  return { id: track.id, style, ...readClip(track, start, duration), x, y, size };
}

export function readStoryComposition(value) {
  const label = "Choose valid story text, colors, and stickers.";
  const data = readJson(value, label);
  if (data === undefined || data === null) return undefined;
  const { background, layers } = data;
  if (typeof background !== "string" || !colorPattern.test(background) || !Array.isArray(layers) || layers.length > 16) throw invalid(label);
  return { background, layers: layers.map((layer) => {
    if (!layer || !within(layer.x, 0, 100) || !within(layer.y, 0, 100) || !within(layer.size, 3, 36)) throw invalid(label);
    const { x, y, size, kind, text, font, color, fill } = layer;
    if (kind === "sticker" && stickers.has(text)) return { kind, x, y, size, text };
    if (kind !== "text" || typeof text !== "string" || !text.trim() || text.length > 120 || !fonts.has(font)
      || typeof color !== "string" || !colorPattern.test(color) || (fill !== null && (typeof fill !== "string" || !colorPattern.test(fill)))) throw invalid(label);
    return { kind, x, y, size, text, font, color, fill };
  }) };
}
