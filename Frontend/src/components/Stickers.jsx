import { Popover, PopoverContent, PopoverTrigger, Portal } from "@chakra-ui/react";
import { useState } from "react";
import { FiSmile } from "react-icons/fi";

import { loadStickerPack, stickerImage, stickerKey, stickers } from "../lib/stickers";

export function Sticker({ code, label: imageLabel, compact = false }) {
  if (code.startsWith("pack-")) return <img className={`pack-sticker${compact ? " pack-sticker-small" : ""}`}
    src={stickerImage(code)} alt={imageLabel || "Sticker"} loading="lazy" />;
  const [face, label, color] = stickers[code];
  return <span className={`tamil-sticker${compact ? " tamil-sticker-small" : ""}`} style={{ "--sticker-color": color }}>
    <span aria-hidden="true">{face}</span><strong lang="ta">{label}</strong>
  </span>;
}

export function MessageSticker({ text }) {
  const key = stickerKey(text);
  return key ? <Sticker code={key} /> : null;
}

function Inline({ children }) { return children; }

export default function StickerPicker({ onSelect, disabled, onOpenChange, nested = false }) {
  const Container = nested ? Inline : Portal;
  const [pack, setPack] = useState(null);
  const [error, setError] = useState("");
  function open() {
    onOpenChange?.(true);
    setError("");
    loadStickerPack().then(setPack).catch(() => setError("Could not load stickers. Reopen to try again."));
  }
  const choices = pack?.length ? pack.map(({ id, label }) => [`pack-${id}`, label])
    : pack ? Object.entries(stickers).map(([id, [, label]]) => [id, label]) : [];
  return <Popover placement="top" isLazy onOpen={open} onClose={() => onOpenChange?.(false)}>
    {({ onClose }) => <>
      <PopoverTrigger>
        <button type="button" className="sticker-trigger" aria-label="Tamil comedy stickers" title="Tamil comedy stickers" disabled={disabled}>
          <FiSmile aria-hidden="true" />
        </button>
      </PopoverTrigger>
      <Container><PopoverContent maxW="min(22rem, 92vw)" className="sticker-popover" aria-label="Tamil comedy stickers">
        {error ? <p role="alert">{error}</p> : !pack ? <p role="status">Loading stickers…</p> : null}
        <div className="sticker-grid">{choices.map(([code, label]) =>
          <button key={code} type="button" aria-label={`Send sticker ${label}`} onClick={() => {
            onSelect(`[[sticker:${code}]]`);
            onClose();
          }}><Sticker code={code} label={label} compact /></button>)}</div>
      </PopoverContent></Container>
    </>}
  </Popover>;
}
