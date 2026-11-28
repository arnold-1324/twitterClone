import { useRef, useState } from "react";
import { FiImage, FiMaximize2, FiMusic, FiPlus, FiSmile, FiTrash2, FiType } from "react-icons/fi";
import { layerStyle, storyFonts } from "../lib/storyFonts";
import { defaultMusic } from "../lib/music";
import MusicPlayer, { TrackArtwork } from "./MusicPlayer";
import MusicPicker from "./MusicPicker";
import { ClipSettings } from "./MusicSettings";

const stickers = ["✨", "💛", "🔥", "🌈", "🌙", "🪩", "🌸", "🎉", "🎶", "☕", "🫶", "🌊", "⚽", "🦋", "💫", "📍"];
const clamp = (n, min, max) => Math.min(max, Math.max(min, n));
const tools = [
  ["text", "Text", FiType], ["sticker", "Stickers", FiSmile], ["music", "Music", FiMusic],
];

export default function StoryEditor({ attachment, source, composition, music, onComposition, onMusic, chooseMedia }) {
  const [tool, setTool] = useState("text");
  const [selected, setSelected] = useState(null);
  const [library, showLibrary] = useState(false);
  const stage = useRef(null);
  const drag = useRef(null);
  const textInput = useRef(null);
  const activeLayer = typeof selected === "number" ? composition.layers[selected] : null;

  function addLayer(kind, text) {
    if (composition.layers.length >= 16) return;
    const index = composition.layers.length;
    const layer = { kind, text, x: 50, y: 37 + Math.min(index * 5, 35), size: kind === "text" ? 8 : 16,
      ...(kind === "text" && { font: "dm-sans", color: "#ffffff", fill: null }) };
    onComposition({ ...composition, layers: [...composition.layers, layer] });
    setSelected(index);
    if (kind === "text") requestAnimationFrame(() => { textInput.current?.focus(); textInput.current?.select(); });
  }

  function update(key, change) {
    if (key === "music") onMusic({ ...music, ...change });
    else onComposition({ ...composition, layers: composition.layers.map((layer, index) =>
      index === key ? { ...layer, ...change } : layer) });
  }

  function select(key, item) {
    setSelected(key);
    setTool(key === "music" ? "music" : item.kind);
  }

  function start(event, key, item, resize = false) {
    if (event.button !== 0) return;
    event.stopPropagation();
    const bounds = stage.current.getBoundingClientRect();
    drag.current = { key, item, resize, bounds, x: event.clientX, y: event.clientY, id: event.pointerId };
    event.currentTarget.setPointerCapture(event.pointerId);
    select(key, item);
  }

  function move(event) {
    const state = drag.current;
    if (!state || state.id !== event.pointerId) return;
    const dx = (event.clientX - state.x) / state.bounds.width * 100;
    const dy = (event.clientY - state.y) / state.bounds.height * 100;
    const { item, key, resize } = state;
    update(key, resize ? { size: clamp(Math.round(item.size + (dx + dy) * .65), key === "music" ? 12 : 3, key === "music" ? 80 : 36) }
      : { x: clamp(item.x + dx, 0, 100), y: clamp(item.y + dy, 0, 100) });
  }

  function keyMove(event, key, item) {
    const directions = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
    const pair = directions[event.key];
    if (!pair) return;
    event.preventDefault();
    const step = event.shiftKey ? 5 : 1;
    update(key, { x: clamp(item.x + pair[0] * step, 0, 100), y: clamp(item.y + pair[1] * step, 0, 100) });
  }

  function remove() {
    if (selected === "music") onMusic(null);
    else onComposition({ ...composition, layers: composition.layers.filter((_, index) => index !== selected) });
    setSelected(null);
  }

  function layer(item, key) {
    const isMusic = key === "music";
    const style = isMusic ? { left: `${item.x}%`, top: `${item.y}%`, width: `${item.size}%` } : layerStyle(item);
    const name = isMusic ? item.track.title : item.text || "Text";
    return <div key={key} className={`story-layer editor-layer${isMusic ? " editor-music-layer" : ""}`}
      style={style} data-selected={selected === key}>
      <button type="button" className="layer-drag" aria-label={`Move ${name}`}
        onClick={() => select(key, item)} onKeyDown={(event) => keyMove(event, key, item)}
        onPointerDown={(event) => start(event, key, item)} onPointerMove={move}
        onLostPointerCapture={() => { drag.current = null; }}>
        {isMusic ? <TrackArtwork music={item} playing /> : item.text || "Text"}
      </button>
      {selected === key && <button type="button" className="layer-resize" aria-label={`Resize ${name}`}
        onPointerDown={(event) => start(event, key, item, true)} onPointerMove={move}
        onLostPointerCapture={() => { drag.current = null; }}><FiMaximize2 /></button>}
    </div>;
  }

  return <div className="story-editor">
    <div className="story-editor-toolbar">
      {!source && <button type="button" onClick={chooseMedia}><FiImage />{attachment ? "Change media" : "Choose media"}</button>}
      {tools.map(([id, label, Icon]) => <button key={id} type="button" aria-pressed={tool === id} onClick={() => {
        setTool(id);
        if (id === "music") {
          setSelected(music ? "music" : null);
          showLibrary(!music);
        }
      }}><Icon />{label}</button>)}
    </div>
    <div className="story-editor-layout">
      <div className="editor-canvas" ref={stage} style={{ background: composition.background }}>
        {attachment?.video ? <video src={attachment.url} muted loop autoPlay playsInline />
          : attachment ? <img src={attachment.url} alt="Story canvas" />
            : !composition.layers.length && !music && <p>{source ? `Shared from @${source.username}` : "Add something to your story"}</p>}
        {composition.layers.map((item, index) => layer(item, index))}
        {music && music.style !== "audio" && layer(music, "music")}
      </div>
      <div className="editor-inspector">
        <label className="editor-color">Canvas color <input type="color" aria-label="Canvas color"
          value={composition.background} onChange={(event) => onComposition({ ...composition, background: event.target.value })} /></label>
        {tool === "text" && <>
          <button type="button" onClick={() => addLayer("text", "Your text")} disabled={composition.layers.length >= 16}><FiPlus /> Add text</button>
          {activeLayer?.kind === "text" && <>
            <label>Story text <textarea ref={textInput} value={activeLayer.text} maxLength={120}
              onChange={(event) => update(selected, { text: event.target.value })} /></label>
            <label>Font family <select value={activeLayer.font} onChange={(event) => update(selected, { font: event.target.value })}>
              {Object.entries(storyFonts).map(([key, name]) => <option key={key} value={key}>{name}</option>)}
            </select></label>
            <div className="editor-palette">
              <label>Text color <input type="color" value={activeLayer.color} onChange={(event) => update(selected, { color: event.target.value })} /></label>
              <label><input type="checkbox" checked={Boolean(activeLayer.fill)} onChange={(event) =>
                update(selected, { fill: event.target.checked ? "#202a3d" : null })} /> Text background</label>
              {activeLayer.fill && <input type="color" aria-label="Text background color" value={activeLayer.fill}
                onChange={(event) => update(selected, { fill: event.target.value })} />}
            </div>
          </>}
        </>}
        {tool === "sticker" && <div className="editor-stickers" aria-label="Stickers">{stickers.map((sticker) => (
          <button key={sticker} type="button" aria-label={`Add ${sticker} sticker`} onClick={() => addLayer("sticker", sticker)}
            disabled={composition.layers.length >= 16}>{sticker}</button>
        ))}</div>}
        {tool === "music" && <>
          <button type="button" onClick={() => showLibrary(!library)}>{music ? "Change track" : "Choose track"}</button>
          {library && <MusicPicker onClose={() => showLibrary(false)} onSelect={(track) => {
            onMusic(defaultMusic(track, music)); setSelected("music"); showLibrary(false);
          }} />}
          {music && !library && <>
            <MusicPlayer music={music} key={music.id} />
            <ClipSettings music={music} onChange={onMusic} />
          </>}
        </>}
        {(activeLayer || (selected === "music" && music)) && <>
          <label>Layer size
            <input type="range" min={activeLayer ? 3 : 12} max={activeLayer ? 36 : 80} value={activeLayer?.size ?? music.size}
              onChange={(event) => update(selected, { size: Number(event.target.value) })} />
          </label>
          <button type="button" onClick={remove}><FiTrash2 /> Remove layer</button>
        </>}
      </div>
    </div>
  </div>;
}
