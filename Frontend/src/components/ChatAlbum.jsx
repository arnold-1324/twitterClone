import { useLayoutEffect, useRef, useState } from "react";
import { IconButton, Modal, ModalBody, ModalCloseButton, ModalContent, ModalHeader, ModalOverlay } from "@chakra-ui/react";
import { FiChevronLeft, FiChevronRight, FiFileText, FiFilm, FiHeadphones } from "react-icons/fi";
import AdaptiveVideo from "./AdaptiveVideo";
import ChatAttachment from "./ChatAttachment";

function Tile({ item, index }) {
  if (item.kind === "image") return <img src={item.url} loading="lazy" alt={`Shared photo ${index + 1}`} />;
  const Icon = item.kind === "video" ? FiFilm : item.kind === "audio" ? FiHeadphones : FiFileText;
  return <span className="album-file-tile"><Icon aria-hidden="true" /><small>{item.attachment?.name ?? item.kind}</small></span>;
}

function AlbumGallery({ items, start, onClose }) {
  const rail = useRef(null);
  const close = useRef(null);
  const [position, setPosition] = useState(start);
  useLayoutEffect(() => {
    const frame = requestAnimationFrame(() => {
      const element = rail.current;
      element?.scrollTo({ left: start * element.clientWidth, behavior: "instant" });
    });
    return () => cancelAnimationFrame(frame);
  }, [start]);

  function move(index) {
    const element = rail.current;
    if (!element) return;
    element.scrollTo({ left: index * element.clientWidth,
      behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" });
  }

  return <Modal isOpen onClose={onClose} isCentered size="xl" initialFocusRef={close}>
    <ModalOverlay />
    <ModalContent className="ephemeral-dialog album-dialog" mx={3} aria-label="Attachments">
      <ModalHeader>Attachments <small aria-live="polite">{position + 1} of {items.length}</small></ModalHeader>
      <ModalCloseButton ref={close} />
      <ModalBody>
        <div className="album-rail" ref={rail} aria-label="Browse attachments" tabIndex={0}
          onScroll={({ currentTarget: target }) => {
            if (target.clientWidth) setPosition(Math.round(target.scrollLeft / target.clientWidth));
          }}
          onKeyDown={(event) => {
            if (!["ArrowLeft", "ArrowRight"].includes(event.key)) return;
            event.preventDefault();
            move(position + (event.key === "ArrowRight" ? 1 : -1));
          }}>
          {items.map((item, index) => <div className="album-slide" key={item.url}>
            {item.kind === "image" ? <img src={item.url} alt={`Shared photo ${index + 1}`} loading="lazy" />
              : item.kind === "file" ? <ChatAttachment url={item.url} attachment={item.attachment} />
                : position !== index ? <Tile item={item} index={index} />
                  : item.kind === "video" ? <AdaptiveVideo src={item.url} streamUrl={item.streamUrl} aria-label={`Video ${index + 1}`} />
                    : <audio src={item.url} controls preload="metadata" aria-label={`Audio ${index + 1}`} />}
          </div>)}
        </div>
        <div className="album-navigation">
          <IconButton variant="ghost" icon={<FiChevronLeft />} aria-label="Previous attachment" isDisabled={!position} onClick={() => move(position - 1)} />
          <IconButton variant="ghost" icon={<FiChevronRight />} aria-label="Next attachment" isDisabled={position === items.length - 1} onClick={() => move(position + 1)} />
        </div>
      </ModalBody>
    </ModalContent>
  </Modal>;
}

export default function ChatAlbum({ items }) {
  const [start, setStart] = useState(null);
  const extra = Math.max(0, items.length - 4);
  return <div className="chat-album" aria-label={`${items.length} attachments`}>
    <div className="chat-album-grid">
      {items.slice(0, 4).map((item, index) => <button type="button" key={item.url} onClick={() => setStart(index)}
        aria-label={`Open attachment ${index + 1} of ${items.length}`}>
        <Tile item={item} index={index} />
        {index === 3 && extra > 0 && <span className="album-more">+{extra}</span>}
      </button>)}
    </div>
    {start !== null && <AlbumGallery items={items} start={start} onClose={() => setStart(null)} />}
  </div>;
}
