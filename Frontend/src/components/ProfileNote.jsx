import { useState } from "react";
import { Popover, PopoverContent, PopoverTrigger, Portal } from "@chakra-ui/react";
import { FiMusic, FiPlus } from "react-icons/fi";
import { useNavigate } from "react-router-dom";
import { clearEphemeralCache, noteProfilePath, notesPath } from "../lib/ephemeralCache";
import NoteMusicLabel from "./NoteMusicLabel";
import { noteTrackId } from "../lib/music";
import useEphemeralShelf from "../hooks/useEphemeralShelf";
import { NoteCard, NoteEditor } from "./NoteDialogs";

export default function ProfileNote({ person, viewer }) {
  const own = viewer?._id === person._id;
  const { data, update } = useEphemeralShelf(viewer ? noteProfilePath(person._id) : null, viewer?._id);
  const note = data && Date.parse(data.expiresAt) > Date.now() ? data : null;
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const navigate = useNavigate();
  const music = noteTrackId(note);

  function apply(next) {
    clearEphemeralCache(viewer._id, (path) => path === notesPath);
    update(() => next ? { ...next, author: person } : null);
    setEditing(false);
    setOpen(Boolean(next));
  }

  if (!viewer || (!note && !own)) return null;
  return <div className="profile-note">
    {note ? <Popover placement="bottom-end" isLazy isOpen={open} onOpen={() => setOpen(true)} onClose={() => setOpen(false)}>
      <PopoverTrigger>
        <button type="button" className="note-bubble profile-note-trigger" data-note-theme={note.theme}
          aria-label={own ? "View your profile note" : `View note by ${person.username}`}>
          <span>{music && <FiMusic />}<NoteMusicLabel note={note} /></span>
        </button>
      </PopoverTrigger>
      <Portal><PopoverContent className="note-detail-popover" aria-label={own ? "Your note" : `${person.username}’s note`}>
        <NoteCard key={note.updatedAt} note={note} own={own} music={music} active={open}
          onReplace={() => { setOpen(false); setEditing(true); }} onRemoved={() => apply(null)}
          onReply={(message, author) => navigate("/chat", { state: { noteReply: { conversationId: message.conversationId, author } } })} />
      </PopoverContent></Portal>
    </Popover> : <button type="button" className="note-bubble profile-note-trigger" onClick={() => setEditing(true)}>
      <FiPlus /> Add a note
    </button>}
    {editing && <NoteEditor user={person} onClose={() => setEditing(false)} onSaved={apply} />}
  </div>;
}
