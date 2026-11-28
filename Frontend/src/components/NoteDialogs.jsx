import StickerPicker from "./Stickers";
import { useState } from "react";
import {
  Avatar, Button, Modal, ModalBody, ModalCloseButton, ModalContent, ModalFooter, ModalHeader, ModalOverlay, PopoverCloseButton,
} from "@chakra-ui/react";
import { FiMusic, FiSend, FiX } from "react-icons/fi";
import { apiFetch, readApiJson } from "../lib/apiFetch";
import MusicPicker from "./MusicPicker";
import MusicPlayer from "./MusicPlayer";
import { ClipSettings } from "./MusicSettings";
import { defaultMusic } from "../lib/music";


const themes = [
  ["ink", "Ink"], ["mint", "Mint"], ["plum", "Plum"],
  ["rose", "Rose"], ["sky", "Sky"], ["amber", "Amber"],
];
export function NoteEditor({ user, onClose, onSaved }) {
  const [text, setText] = useState("");
  const [theme, setTheme] = useState("ink");
  const [selection, setSelection] = useState(null);
  const [picking, setPicking] = useState(false);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function save() {
    if (pending) return;
    setPending(true);
    setError("");
    try {
      const response = await apiFetch("/api/notes", {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, theme, musicId: selection?.id, musicStart: selection?.start, musicDuration: selection?.duration }),
      });
      const note = await readApiJson(response);
      if (!response.ok) throw new Error(note.error || "Could not save your note.");
      onSaved(note);
    } catch (error) {
      setError(error.message);
      setPending(false);
    }
  }

  return <Modal isOpen isCentered onClose={onClose} closeOnEsc={!pending} closeOnOverlayClick={!pending}>
    <ModalOverlay />
    <ModalContent className="ephemeral-dialog notes-dialog" mx={3} maxH="92dvh" overflowY="auto">
      <form onSubmit={(event) => { event.preventDefault(); void save(); }}>
        <ModalHeader>New note</ModalHeader>
        <ModalCloseButton isDisabled={pending} />
        <ModalBody className="notes-editor">
          <div className="note-editor-preview">
            <div className="note-bubble" data-note-theme={theme}>{text || selection?.track.title || "Share a thought"}</div>
            <Avatar size="lg" name={user.fullName} src={user.profileImg} />
          </div>
          <label className="ephemeral-field">Quote or thought
            <textarea rows={2} value={text} maxLength={120} onChange={(event) => setText(event.target.value)} />
          </label>
          <div className="note-themes" role="group" aria-label="Note background">
            {themes.map(([id, label]) => <button type="button" key={id} data-note-theme={id}
              aria-label={`${label} background`} aria-pressed={theme === id} onClick={() => setTheme(id)} />)}
          </div>
          <div className="composer-music-tools">
            <button type="button" onClick={() => setPicking(!picking)}><FiMusic />{selection ? "Change track" : "Add music"}</button>
            {selection && <button type="button" aria-label="Remove music" onClick={() => setSelection(null)}><FiX /></button>}
          </div>
          {picking && <MusicPicker onClose={() => setPicking(false)} onSelect={(selected) => { setSelection(defaultMusic(selected)); setPicking(false); }} />}
          {selection && !picking && <>
            <MusicPlayer key={selection.id} music={selection} />
            <ClipSettings music={selection} onChange={setSelection} showDisplay={false} />
          </>}
          <small>Shared for 24 hours with people who follow you and whom you follow back.</small>
          {error && <p role="alert" className="ephemeral-error">{error}</p>}
        </ModalBody>
        <ModalFooter gap={2}>
          <Button type="submit" colorScheme="teal" isLoading={pending} isDisabled={!text.trim() && !selection}>Share note</Button>
        </ModalFooter>
      </form>
    </ModalContent>
  </Modal>;
}

export function NoteCard({ note, own, music, active, onReplace, onRemoved, onReply }) {
  const [reply, setReply] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function submit(remove, text = reply) {
    if (pending || (!remove && !text.trim())) return;
    setPending(true);
    setError("");
    try {
      if (remove) {
        const response = await apiFetch("/api/notes", { method: "DELETE" });
        if (!response.ok) throw new Error((await readApiJson(response)).error || "Could not delete your note.");
        onRemoved();
      } else {
        const response = await apiFetch("/api/messages/send", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ recipientId: note._id, noteVersion: note.updatedAt, message: text }),
        });
        const message = await readApiJson(response);
        if (!response.ok) throw new Error(message.error || "Could not send your reply.");
        onReply(message, note.author);
      }
    } catch (failure) {
      setError(failure.message);
      setPending(false);
    }
  }

  return <div className="note-detail">
    <PopoverCloseButton aria-label="Close note" />
    <div className="note-detail-profile">
      {note.text && <p className="note-bubble" data-note-theme={note.theme}>{note.text}</p>}
      <Avatar size="lg" name={note.author.fullName || note.author.username} src={note.author.profileImg} />
      <strong>{note.author.fullName || note.author.username}</strong>
    </div>
    {music ? <MusicPlayer key={music} music={{ id: music, start: note.musicStart ?? 0, duration: note.musicDuration ?? 20, style: "card" }} active={active} autoPlay />
      : (note.trackId || note.albumId) && <small>Track unavailable</small>}
    {error && <p role="alert" className="ephemeral-error">{error}</p>}
    {own ? <div className="note-detail-actions">
      <small>Shared with mutual followers</small>
      <Button colorScheme="teal" size="sm" onClick={onReplace} isDisabled={pending}>Leave a new note</Button>
      <Button variant="ghost" colorScheme="red" size="sm" onClick={() => void submit(true)} isLoading={pending}>Delete note</Button>
    </div> : <form className="note-reply" onSubmit={(event) => { event.preventDefault(); void submit(false); }}>
      <input aria-label="Reply to note" placeholder="Send a message…" maxLength={4000}
        value={reply} onChange={(event) => setReply(event.target.value)} />
      <StickerPicker nested disabled={pending} onSelect={(text) => void submit(false, text)} />
      <button type="submit" aria-label="Send note reply" disabled={!reply.trim() || pending}><FiSend /></button>
    </form>}
  </div>;
}

