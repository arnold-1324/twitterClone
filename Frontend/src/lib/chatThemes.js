const artwork = import.meta.glob("../assets/chat-themes/*.webp", { eager: true, query: "?url", import: "default" });

const themes = [
  ["default", "Default", "#151d27", "#6897bd"],
  ["alpine-glow", "Alpine Glow", "#22364a", "#efa47e"],
  ["night-train", "Night Train", "#181f35", "#e2a26e"],
  ["starling-forest", "Starling Forest", "#142b3a", "#b193ec"],
  ["lunar-tide", "Lunar Tide", "#17233d", "#a6b9e9"],
  ["amber-dunes", "Amber Dunes", "#422719", "#eca969"],
  ["glass-garden", "Glass Garden", "#142a3b", "#74cee2"],
  ["lantern-alley", "Lantern Alley", "#332217", "#f3ad72"],
  ["emerald-ruins", "Emerald Ruins", "#172f2d", "#89bc83"],
  ["sakura-rain", "Sakura Rain", "#382231", "#ed9bbf"],
  ["cobalt-city", "Cobalt City", "#152749", "#68abfa"],
  ["koi-pond", "Koi Pond", "#193236", "#e7a27d"],
  ["sunset-drive", "Sunset Drive", "#392535", "#f0a5a1"],
  ["neon-pup", "Neon Pup", "#132833", "#65ead5"],
  ["pixel-portal", "Pixel Portal", "#251b41", "#bc9cf5"],
  ["cloud-islands", "Cloud Islands", "#302b43", "#cca9f0"],
  ["paper-comet", "Paper Comet", "#1b283e", "#acc9ea"],
  ["aurora-drift", "Aurora Drift", "#112d30", "#78d9ad"],
  ["quiet-library", "Quiet Library", "#30241f", "#c7a577"],
  ["deep-current", "Deep Current", "#102a3c", "#76d0f6"],
  ["coral-hour", "Coral Hour", "#3a2734", "#eea28f"],
];

export const chatThemes = themes.map(([id, name, base, accent]) => ({
  id, name, base, accent, image: artwork[`../assets/chat-themes/${id}.webp`],
}));

export function getChatTheme(id, image) {
  if (id === "custom" && image) return { ...chatThemes[0], id, name: "Custom image", image };
  return chatThemes.find((theme) => theme.id === id) ?? chatThemes[0];
}

export const chatFonts = [
  { id: "default", name: "Default" },
  { id: "rounded", name: "Rounded", family: '"Nunito", sans-serif' },
  { id: "modern", name: "Modern", family: '"DM Sans", sans-serif' },
  { id: "typewriter", name: "Typewriter", family: '"IBM Plex Mono", monospace' },
  { id: "serif", name: "Serif", family: '"Source Serif 4", Georgia, serif' },
  { id: "poster", name: "Poster", family: '"Fraunces", Georgia, serif' },
  { id: "handwritten", name: "Handwritten", family: '"Caveat", cursive' },
];

export const getChatFont = (id) => chatFonts.find((font) => font.id === id) ?? chatFonts[0];

export function chatWallpaperStyle({ base, accent, image }) {
  return {
    "--wallpaper-base": base,
    "--wallpaper-accent": accent,
    "--wallpaper-image": image ? `url("${image}")` : "none",
  };
}
