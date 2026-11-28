import { useEffect, useRef, useState } from "react";
import {
  Avatar, Popover, PopoverContent, PopoverTrigger, Portal, useBreakpointValue,
} from "@chakra-ui/react";
import { FiChevronLeft, FiChevronRight, FiMusic, FiPlus } from "react-icons/fi";
import useShelfNavigation from "../hooks/useShelfNavigation";
import useEphemeralShelf from "../hooks/useEphemeralShelf";
import { clearEphemeralCache, noteProfilePath, notesPath } from "../lib/ephemeralCache";
import { canPreloadMedia } from "../lib/storyPreload";
import { NoteEditor, NoteCard } from "./NoteDialogs";
import NoteMusicLabel from "./NoteMusicLabel";
import { noteTrackId } from "../lib/music";

export default function NotesShelf({ user, onReply }) {
  const { data, error, reload, update } = useEphemeralShelf(notesPath, user._id);
  const [editor, setEditor] = useState(false);
  const [selected, setSelected] = useState(null);
  const [warm, setWarm] = useState(null);
  const warmTimer = useRef(null);
  const placement = useBreakpointValue({ base: "bottom-start", md: "right-start" }) ?? "bottom-start";
  const rows = (data ?? []).filter(({ expiresAt }) => new Date(expiresAt).getTime() > Date.now());
  const own = rows.find(({ _id }) => _id === user._id);
  const { track, position, measure, move } = useShelfNavigation(rows.length + Number(!own));
  const visibleRows = rows.slice(Math.max(0, position.first - Number(!own)), position.first + position.visible - Number(!own));
  const warmNote = !selected && !editor && canPreloadMedia()
    ? (visibleRows.find((note) => note._id === warm && noteTrackId(note)) ?? visibleRows.find((note) => noteTrackId(note)))?._id
    : null;

  useEffect(() => () => clearTimeout(warmTimer.current), []);

  function scheduleWarm(note) {
    if (!noteTrackId(note) || !canPreloadMedia()) return;
    clearTimeout(warmTimer.current);
    warmTimer.current = setTimeout(() => setWarm(note._id), 160);
  }

  function navigateNotes(direction) {
    move(direction);
    clearTimeout(warmTimer.current);
    setSelected(null);
    setWarm(null);
  }

  function saved(note) {
    clearEphemeralCache(user._id, (path) => path === noteProfilePath(user._id));
    update((current) => [{ ...note, author: user }, ...(current ?? []).filter(({ _id }) => _id !== user._id)]);
    setEditor(false);
    setSelected(user._id);
    reload();
  }

  return <section className="inbox-notes" aria-label="Notes">
    <div className="note-carousel">
      <button className="note-carousel-arrow" type="button" aria-label="Previous note"
        disabled={!position.previous} onClick={() => navigateNotes(-1)}><FiChevronLeft aria-hidden="true" /></button>
      <div className="note-shelf" ref={track} onScroll={measure}>
      {!own && <button className="note-shelf-entry" type="button" aria-label="Add a note" onClick={() => setEditor(true)}>
        <span className="note-bubble"><span><FiPlus /> New note</span></span>
        <Avatar name={user.fullName} src={user.profileImg} />
        <small>Your note</small>
      </button>}
      {rows.map((note) => {
        const mine = note._id === user._id;
        const music = noteTrackId(note);
        const name = mine ? "Your note" : `${note.author.username}’s note`;
        return <Popover key={note._id} placement={placement} autoFocus={false}
          isOpen={selected === note._id} onOpen={() => setSelected(note._id)}
          onClose={() => setSelected((current) => current === note._id ? null : current)}>
          <PopoverTrigger><button className="note-shelf-entry" type="button"
            onPointerEnter={() => scheduleWarm(note)} onFocus={() => scheduleWarm(note)}
            aria-label={mine ? "View your note" : `View note by ${note.author.username}`}>
            <span className="note-bubble" data-note-theme={note.theme}><span>
              {music && <FiMusic />}<NoteMusicLabel note={note} />
            </span></span>
            <Avatar name={note.author.fullName} src={note.author.profileImg} />
            <small>{mine ? "Your note" : note.author.username}</small>
          </button></PopoverTrigger>
          {(selected === note._id || warmNote === note._id) && <Portal><PopoverContent className="note-detail-popover" aria-label={name}>
            <NoteCard key={note.updatedAt} note={note} own={mine} music={music} active={selected === note._id}
              onReplace={() => { setSelected(null); setEditor(true); }}
              onRemoved={() => {
                clearEphemeralCache(user._id, (path) => path === noteProfilePath(user._id));
                update((current) => (current ?? []).filter(({ _id }) => _id !== user._id));
                setSelected(null);
                reload();
              }}
              onReply={(message, author) => { setSelected(null); onReply?.(message, author); }} />
          </PopoverContent></Portal>}
        </Popover>;
      })}
      </div>
      <button className="note-carousel-arrow" type="button" aria-label="Next note"
        disabled={!position.next} onClick={() => navigateNotes(1)}><FiChevronRight aria-hidden="true" /></button>
    </div>
    {error && <button className="ephemeral-retry" onClick={reload}>Retry notes</button>}
    {editor && <NoteEditor user={user} onClose={() => setEditor(false)} onSaved={saved} />}
  </section>;
}
