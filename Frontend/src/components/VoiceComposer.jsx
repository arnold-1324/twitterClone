import { useEffect, useRef, useState } from "react";
import { FiMic, FiPause, FiPlay, FiSquare, FiX } from "react-icons/fi";
import { IoSendSharp } from "react-icons/io5";

export default function VoiceComposer({ voice, sending, onSend }) {
  const player = useRef(null);
  const [url, setUrl] = useState("");
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    if (!voice.file) return;
    const preview = URL.createObjectURL(voice.file);
    setUrl(preview);
    return () => URL.revokeObjectURL(preview);
  }, [voice.file]);

  const recording = voice.phase === "recording";
  const ready = voice.phase === "ready";
  const busy = sending || voice.phase === "finishing";
  const seconds = `${Math.floor(voice.seconds / 60)}:${String(voice.seconds % 60).padStart(2, "0")}`;
  const status = recording ? "Recording" : ready ? "Voice preview" : voice.phase === "opening" ? "Opening microphone" : "Preparing audio";

  function togglePlayback() {
    const audio = player.current;
    if (!audio) return;
    if (audio.paused) void audio.play().catch(() => setPlaying(false));
    else audio.pause();
  }

  return <div className="voice-composer" aria-label="Voice message">
    <button className="voice-control" type="button" aria-label="Discard recording" disabled={sending} onClick={voice.discard}><FiX /></button>
    <div className="voice-track">
      {recording && <button className="voice-control" type="button" aria-label="Stop recording" onClick={() => void voice.stop()}><FiSquare /></button>}
      {ready && <button className="voice-control" type="button" aria-label={playing ? "Pause preview" : "Play preview"}
        onClick={togglePlayback} disabled={!url}>{playing ? <FiPause /> : <FiPlay />}</button>}
      {!ready && !recording && <FiMic aria-hidden="true" />}
      <div className="voice-details">
        <span className="voice-status" role="status">{recording && <i />}{status}</span>
        <div className="voice-wave" aria-hidden="true">
          {voice.levels.map((level, index) => <i key={index} style={{ "--level": level }} />)}
        </div>
      </div>
      <span className="voice-time" aria-label="Recording duration">{seconds}</span>
    </div>
    <button className="voice-control voice-send" type="button" aria-label="Send voice message"
      disabled={busy || (!ready && !recording)} onClick={onSend}><IoSendSharp /></button>
    {ready && <audio ref={player} src={url || undefined} preload="metadata" onPlay={() => setPlaying(true)}
      onPause={() => setPlaying(false)} onEnded={() => setPlaying(false)} />}
  </div>;
}
