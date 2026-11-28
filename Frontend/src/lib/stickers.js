export const stickers = {
  adada: ["😵", "அடடா!", "#9363c7"],
  sema: ["😎", "செம காமெடி!", "#2e7797"],
  sirippu: ["😂", "சிரிச்சு முடியல!", "#a0601c"],
  ayyo: ["😱", "ஐயய்யோ!", "#ab416c"],
  podhum: ["🙈", "போதும் சாமி!", "#516d2d"],
  enna: ["🤨", "என்ன நடக்குது?", "#3263be"],
  vera: ["🤯", "வேற லெவல்!", "#a14d45"],
  seri: ["🤭", "சரி சரி!", "#397873"],
};

export function stickerKey(value) {
  const key = /^\[\[sticker:([a-z]+|pack-[a-f0-9]{64})\]\]$/.exec(value ?? "")?.[1];
  return key && (Object.hasOwn(stickers, key) || key.startsWith("pack-")) ? key : null;
}

export function stickerLabel(value) {
  const key = stickerKey(value);
  return key ? stickers[key]?.[1] ?? "Sticker" : null;
}

let library;
export function loadStickerPack() {
  if (library?.expires > Date.now()) return library.result;
  const result = fetch("/api/music/stickers").then((response) => {
    if (!response.ok) throw new Error("Sticker pack is unavailable.");
    return response.json();
  }).catch((error) => {
    if (library?.result === result) library = undefined;
    throw error;
  });
  library = { result, expires: Date.now() + 30_000 };
  return result;
}

export function stickerImage(code) {
  return `/api/music/stickers/${code.slice(5)}.webp`;
}
