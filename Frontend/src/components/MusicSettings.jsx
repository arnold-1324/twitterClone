import { useState } from "react";
import { FiMusic, FiX } from "react-icons/fi";
import { defaultMusic } from "../lib/music";
import MusicPicker from "./MusicPicker";
import MusicPlayer from "./MusicPlayer";

function time(seconds) {
  return `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`;
}

export function ClipSettings({ music, onChange, showDisplay = true }) {
  const { track, start, duration } = music;
  const trending = track.trending ?? [];
  const segment = (from, to) => ({ left: `${from / track.duration * 100}%`, width: `${(to - from) / track.duration * 100}%` });

  return <div className="clip-settings">
    {showDisplay && <label>Display
      <select value={music.style} onChange={(event) => onChange({ ...music, style: event.target.value })}>
        <option value="audio">Audio only</option><option value="card">Music card</option><option value="record">Spinning record</option>
      </select>
    </label>}
    {track.provider !== "spotify" && <>
      <div className="clip-timeline" role="group" aria-label={`Track timeline, ${time(track.duration)} total`}>
        {trending.map(({ start: from, end }) => <button key={from} type="button" style={segment(from, end)}
          aria-label={`Select popular section at ${time(from)}`} title={`Popular section at ${time(from)}`}
          onClick={() => onChange({ ...music, start: Math.min(from, track.duration - duration) })} />)}
        <span style={segment(start, start + duration)} aria-hidden="true" />
      </div>
      <div className="clip-timeline-labels"><span>0:00</span>
        {Boolean(trending.length) && <span>Popular sections</span>}<span>{time(track.duration)}</span>
      </div>
      <label>Clip start <output>{time(start)}</output>
        <input type="range" aria-label="Clip start" min="0" max={track.duration - duration} value={start}
          onChange={(event) => onChange({ ...music, start: Number(event.target.value) })} />
      </label>
      <label>Clip length <output>{duration}s</output>
        <input type="range" aria-label="Clip length" min="5" max={Math.min(30, track.duration - start)} value={duration}
          onChange={(event) => onChange({ ...music, duration: Number(event.target.value) })} />
      </label>
    </>}
  </div>;
}

export default function MusicSettings({ music, onChange }) {
  const [open, setOpen] = useState(false);
  return <div className="composer-music">
    <div className="composer-music-tools">
      <button type="button" onClick={() => setOpen(!open)}><FiMusic />{music ? "Change track" : "Add music"}</button>
      {music && <button type="button" aria-label="Remove music" onClick={() => onChange(null)}><FiX /></button>}
    </div>
    {open && <MusicPicker onClose={() => setOpen(false)} onSelect={(track) => { onChange(defaultMusic(track, music)); setOpen(false); }} />}
    {music && <>
      <MusicPlayer key={music.id} music={music} />
      <ClipSettings music={music} onChange={onChange} />
    </>}
  </div>;
}
