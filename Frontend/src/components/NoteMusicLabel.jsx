import { noteTrackId, useMusicTrack } from "../lib/music";

export default function NoteMusicLabel({ note }) {
  const id = noteTrackId(note);
  const track = useMusicTrack(id);
  if (note?.text) return note.text;
  if (id) return track?.title ?? (track === null ? "Track unavailable" : "Music");
  return note?.trackId || note?.albumId ? "Track unavailable" : "";
}
