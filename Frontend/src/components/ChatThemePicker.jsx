import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Button, Modal, ModalBody, ModalCloseButton, ModalContent, ModalFooter, ModalHeader, ModalOverlay } from "@chakra-ui/react";
import { FiCheck, FiEye, FiGrid, FiImage, FiPlus } from "react-icons/fi";
import { chatFonts, chatThemes, chatWallpaperStyle, getChatFont, getChatTheme } from "../lib/chatThemes";

export default function ChatThemePicker({ currentTheme, currentFont, savedImage, onApply, onClose }) {
  const [selection, setSelection] = useState(null);
  const [fontSelection, setFontSelection] = useState(null);
  const [section, setSection] = useState("theme");
  const [draft, setDraft] = useState(null);
  const [removeSaved, setRemoveSaved] = useState(false);
  const [preview, setPreview] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const body = useRef(null);
  const fileInput = useRef(null);
  const galleryScroll = useRef({ theme: 0, font: 0 });
  const image = draft?.url ?? (removeSaved ? null : savedImage);
  const chosen = getChatTheme(selection ?? currentTheme, image);
  const font = getChatFont(fontSelection ?? currentFont);
  const file = chosen.id === "custom" ? draft?.file : undefined;
  const backgroundChanged = chosen.id !== currentTheme || file || removeSaved;
  const fontChanged = font.id !== currentFont;
  const themes = image ? [chatThemes[0], getChatTheme("custom", image), ...chatThemes.slice(1)] : chatThemes;

  useEffect(() => () => { if (draft) URL.revokeObjectURL(draft.url); }, [draft]);

  useLayoutEffect(() => {
    if (body.current) body.current.scrollTop = preview ? 0 : galleryScroll.current[section];
  }, [preview, section]);

  function browse(next) {
    if (!preview) galleryScroll.current[section] = body.current?.scrollTop ?? 0;
    setSection(next);
    setPreview(false);
  }

  function togglePreview() {
    if (!preview) galleryScroll.current[section] = body.current?.scrollTop ?? 0;
    setPreview(!preview);
  }

  function selectImage(event) {
    const selected = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (!selected) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(selected.type) || selected.size > 10 * 1024 * 1024) {
      setError("Choose a JPEG, PNG or WebP image up to 10 MB.");
      return;
    }
    setError("");
    setDraft({ file: selected, url: URL.createObjectURL(selected) });
    setRemoveSaved(false);
    setSelection("custom");
  }

  function removeImage() {
    setError("");
    setDraft(null);
    setRemoveSaved(true);
    if (chosen.id === "custom") setSelection("default");
  }

  async function apply() {
    if (saving || !(backgroundChanged || fontChanged)) return;
    setSaving(true);
    setError("");
    try {
      await onApply({
        ...(backgroundChanged && { backgroundTheme: chosen.id }),
        ...(fontChanged && { chatFont: font.id }),
        ...(removeSaved && { removeCustomBackground: true }),
      }, file);
      onClose();
    } catch (error) {
      setError(error.message);
      setSaving(false);
    }
  }

  return (
    <Modal isOpen onClose={onClose} closeOnEsc={!saving} closeOnOverlayClick={!saving} motionPreset="slideInBottom">
      <ModalOverlay bg="blackAlpha.700" />
      <ModalContent className="chat-theme-dialog" containerProps={{ alignItems: { base: "flex-end", md: "center" } }}
        maxW={{ base: "100%", md: "640px" }} maxH={{ base: "87dvh", md: "min(87dvh, 780px)" }}
        m={{ base: 0, md: 4 }} borderRadius={{ base: "24px 24px 0 0", md: "22px" }} overflow="hidden"
        bg="#171f29" color="#edf4fa">
        <ModalHeader className="chat-theme-header" px={5} pt={5} pb={4}>
          Chat appearance
          <p>Choose a background and font for everyone in this chat.</p>
        </ModalHeader>
        <ModalCloseButton isDisabled={saving} aria-label="Close chat appearance" />
        <div className="chat-theme-tabs" role="group" aria-label="Appearance settings">
          <button type="button" aria-pressed={section === "theme" && !preview} disabled={saving}
            onClick={() => browse("theme")}>Theme</button>
          <button type="button" aria-pressed={section === "font" && !preview} disabled={saving}
            onClick={() => browse("font")}>Font</button>
        </div>
        <ModalBody ref={body} className="chat-theme-body" px={5} py={4}>
          {preview ? (
            <div className="chat-theme-preview wallpaper-surface" style={chatWallpaperStyle(chosen)}
              role="region" aria-label={`${chosen.name} preview`}>
              <span className="chat-theme-preview-name">{chosen.name} · {font.id === "default" ? "Default font" : font.name}</span>
              <div className="chat-theme-preview-messages" style={{ fontFamily: font.family }}>
                <span>How does this background look?</span>
                <span>I like it!</span>
              </div>
            </div>
          ) : section === "font" ? (
            <div className="chat-font-grid" role="group" aria-label="Chat fonts">
              {chatFonts.map((option) => <button key={option.id} type="button" className="chat-font-option"
                aria-pressed={font.id === option.id} disabled={saving} onClick={() => { setFontSelection(option.id); setError(""); }}>
                <span className="chat-font-sample" aria-hidden="true" style={{ fontFamily: option.family }}>Aa</span>
                <span>{option.name}</span>
                {font.id === option.id && <span className="chat-theme-selected" aria-hidden="true"><FiCheck /></span>}
              </button>)}
            </div>
          ) : <>
            <div className="chat-theme-upload-info">
              <small>{removeSaved ? "Saved image will be removed on apply." : "JPEG, PNG or WebP up to 10 MB"}</small>
              {savedImage && !removeSaved && <button type="button" disabled={saving} onClick={removeImage}>Remove saved image</button>}
            </div>
            <div className="chat-theme-grid" role="group" aria-label="Chat backgrounds">
              <input ref={fileInput} hidden type="file" aria-label="Background image" accept="image/jpeg,image/png,image/webp" onChange={selectImage} />
              <button type="button" className="chat-theme-option" disabled={saving} onClick={() => fileInput.current?.click()}>
                <span className="chat-theme-art chat-theme-upload"><FiPlus aria-hidden="true" /></span>
                <span className="chat-theme-label">Upload image</span>
              </button>
              {themes.map((theme) => <button type="button" key={theme.id} className="chat-theme-option"
                aria-pressed={chosen.id === theme.id} disabled={saving} onClick={() => { setSelection(theme.id); setError(""); }}>
                <span className="chat-theme-art" style={{ backgroundColor: theme.base }}>
                  {theme.image ? <img src={theme.image} alt="" loading="lazy" decoding="async" />
                    : <FiImage className="chat-theme-default-icon" aria-hidden="true" />}
                  {chosen.id === theme.id && <span className="chat-theme-selected" aria-hidden="true"><FiCheck /></span>}
                </span>
                <span className="chat-theme-label">{theme.name}</span>
              </button>)}
            </div>
          </>}
        </ModalBody>
        {error && <p className="chat-theme-error" role="alert">{error}</p>}
        <ModalFooter className="chat-theme-actions" px={5} pt={3}>
          <Button leftIcon={preview ? <FiGrid /> : <FiEye />} variant="outline" className="chat-theme-preview-button"
            isDisabled={saving} onClick={togglePreview}>
            {preview ? (section === "theme" ? "Browse themes" : "Browse fonts") : "Preview"}
          </Button>
          <Button className="chat-theme-apply-button" isLoading={saving}
            isDisabled={!backgroundChanged && !fontChanged} onClick={apply}>Apply</Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
