import { useEffect, useRef, useState } from "react";
import { Modal, ModalCloseButton, ModalContent, ModalHeader, ModalOverlay } from "@chakra-ui/react";

export default function EngagementSheet({ open, onClose, title, kind, busy = false, children }) {
  const start = useRef(null);
  const closeButton = useRef(null);
  const [viewport, setViewport] = useState(null);

  useEffect(() => {
    const visual = window.visualViewport;
    if (!open || !visual) return;
    const measure = () => {
      const bottom = Math.max(0, window.innerHeight - visual.height - visual.offsetTop);
      setViewport({ height: visual.height, bottom });
    };
    measure();
    visual.addEventListener("resize", measure);
    visual.addEventListener("scroll", measure);
    return () => {
      visual.removeEventListener("resize", measure);
      visual.removeEventListener("scroll", measure);
    };
  }, [open]);

  return <Modal isOpen={open} onClose={onClose} initialFocusRef={closeButton} motionPreset="slideInBottom"
    scrollBehavior="inside" closeOnEsc={!busy} closeOnOverlayClick={!busy}>
    <ModalOverlay className={kind === "comments" ? "comment-sheet-backdrop" : undefined} />
    <ModalContent className={`engagement-sheet engagement-sheet-${kind}`} style={viewport ? {
      "--sheet-visible": `${viewport.height}px`, "--sheet-obscured": `${viewport.bottom}px`,
    } : undefined}>
      <div className="engagement-sheet-handle" aria-hidden="true"
        onPointerDown={(event) => {
          start.current = event.clientY;
          event.currentTarget.setPointerCapture(event.pointerId);
        }}
        onPointerCancel={() => { start.current = null; }}
        onPointerUp={(event) => {
          if (!busy && start.current !== null && event.clientY - start.current >= 42) onClose();
          start.current = null;
        }}><span /></div>
      <ModalHeader className="engagement-sheet-title">{title}</ModalHeader>
      <ModalCloseButton ref={closeButton} isDisabled={busy} />
      {children}
    </ModalContent>
  </Modal>;
}
