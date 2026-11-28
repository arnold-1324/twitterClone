import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { FiMusic, FiPause, FiPlay, FiVolume2, FiVolumeX } from "react-icons/fi";
import { createPortal } from "react-dom";
import { changeMusicVolume, musicVolume, subscribeMusicVolume } from "../lib/musicVolume";
import { useMusicTrack } from "../lib/music";
import { SpotifyEmbed, SpotifyPreview } from "./SpotifyPlayer";

let playingAudio;

export function TrackArtwork({ music, playing = false }) {
  const { track, style } = music;
  return <span className={`track-art track-art-${style}`} data-playing={playing} style={{ "--track-color": track.accent }}>
    <i aria-hidden="true">{track.artwork ? <img src={track.artwork} alt="" /> : <FiMusic />}</i>
    <span><strong>{track.title}</strong><small>{track.artist}</small></span>
  </span>;
}

export default function MusicPlayer({ music, ...props }) {
  const track = useMusicTrack(music.id, music.track);
  if (!track) return track === null ? <small>Track unavailable</small> : null;
  if (track.provider === "spotify") return <SpotifyTrack key={track.id} music={{ ...music, track }} {...props} />;
  return <TrackPlayback key={track.id} music={{ ...music, track }} {...props} />;
}

function SpotifyTrack({ music, active = true, spotifyAutoPlay = false, overlay = false, onOpenChange }) {
  const [open, setOpen] = useState(false);
  const { track, x = 50, y = 58, size = 49, style = "card" } = music;
  if (spotifyAutoPlay) return <SpotifyEmbed track={track} active={active} autoPlay />;
  const layout = { "--track-x": `${x}%`, "--track-y": `${y}%`, "--track-width": `${size}%` };
  function show(value) {
    setOpen(value);
    onOpenChange?.(value);
  }
  return <div className={`music-player${overlay ? " music-overlay" : ""}${style === "audio" && overlay ? " music-overlay-audio" : ""}`}
    style={layout}>
    <button type="button" aria-label={`Open Spotify player for ${track.title}`} onClick={() => show(true)}>
      {style === "audio" && overlay ? <FiMusic /> : <>
        <TrackArtwork music={{ ...music, style }} playing={open} />
        <span className="track-toggle" aria-hidden="true"><FiPlay /></span>
      </>}
    </button>
    {open && <SpotifyPreview track={track} onClose={() => show(false)} />}
  </div>;
}

function TrackPlayback({ music, active = true, inView = true, volumeAxis, autoPlay = false, overlay = false }) {
  const player = useRef(null);
  const host = useRef(null);
  const [stage, setStage] = useState(null);
  const [showVolume, setShowVolume] = useState(false);
  const sound = useSyncExternalStore(subscribeMusicVolume, musicVolume);
  const wanted = useRef(false);
  const userPaused = useRef(false);
  const [playing, setPlaying] = useState(false);
  const { track, start = 0, duration = track.duration, x = 50, y = 58, size = 49, style = "audio" } = music;
  const layout = { "--track-x": `${x}%`, "--track-y": `${y}%`, "--track-width": `${size}%` };

  useEffect(() => {
    if (overlay) setStage(host.current.closest(".story-stage, .post-audio-stage"));
  }, [overlay]);

  useEffect(() => {
    const audio = player.current;
    audio.volume = autoPlay ? sound.volume : .75;
    audio.muted = autoPlay && sound.muted;
  }, [autoPlay, sound]);

  useEffect(() => {
    const audio = player.current;
    if (!active || !inView) {
      audio.pause();
      return;
    }
    let mounted = true;
    function play() {
      if (!document.hidden && !userPaused.current) {
        void audio.play().catch((error) => {
          if (error.name === "NotAllowedError" && mounted) {
            window.addEventListener("pointerup", play, { once: true });
            window.addEventListener("keydown", play, { once: true });
          }
        });
      }
    }
    function resume() {
      if (autoPlay || wanted.current) play();
    }
    function visibility() {
      if (document.hidden) audio.pause();
      else resume();
    }
    document.addEventListener("visibilitychange", visibility);
    resume();
    return () => {
      mounted = false;
      document.removeEventListener("visibilitychange", visibility);
      window.removeEventListener("pointerup", play);
      window.removeEventListener("keydown", play);
      audio.pause();
      if (playingAudio === audio) playingAudio = undefined;
    };
  }, [active, autoPlay, inView, track.url]);

  useEffect(() => {
    const audio = player.current;
    if (audio.readyState >= 1) audio.currentTime = start;
  }, [start, duration, track.url]);

  function begin() {
    const audio = player.current;
    if (audio.currentTime < start || audio.currentTime >= start + duration) audio.currentTime = start;
  }

  function toggle() {
    const audio = player.current;
    if (audio.paused) {
      if (!active) return;
      userPaused.current = false;
      begin();
      void audio.play().catch(() => {});
    } else {
      wanted.current = false;
      userPaused.current = true;
      audio.pause();
    }
  }

  function changeVolume(next) {
    const audio = player.current;
    audio.muted = next.muted;
    if (next.volume !== undefined) audio.volume = next.volume;
    changeMusicVolume(next);
    if (!next.muted && active && inView && !userPaused.current) {
      begin();
      void audio.play().catch(() => {});
    }
  }

  const volumeControl = autoPlay && volumeAxis && <div className={`music-volume music-volume-${volumeAxis}${stage ? " music-volume-overlay" : ""}`}
    onMouseEnter={() => setShowVolume(true)} onMouseLeave={() => setShowVolume(false)}
    onFocus={() => setShowVolume(true)} onBlur={(event) => {
      if (!event.currentTarget.contains(event.relatedTarget)) setShowVolume(false);
    }}>
    {showVolume && <input type="range" min="0" max="100" value={sound.muted ? 0 : Math.round(sound.volume * 100)}
      aria-label="Music volume" aria-orientation={volumeAxis} onChange={(event) => {
        const volume = Number(event.target.value) / 100;
        changeVolume({ volume, muted: volume === 0 });
      }} />}
    <button type="button" onClick={() => changeVolume({ muted: !sound.muted, volume: sound.volume || .75 })}
      aria-label={sound.muted ? "Enable music audio" : "Mute music audio"}>
      {sound.muted ? <FiVolumeX aria-hidden="true" /> : <FiVolume2 aria-hidden="true" />}
    </button>
  </div>;

  return <div ref={host} className={`music-player${overlay ? " music-overlay" : ""}${style === "audio" && overlay ? " music-overlay-audio" : ""}`} style={layout}>
    {stage ? createPortal(volumeControl, stage) : volumeControl}
    <audio ref={player} muted={autoPlay && sound.muted} src={track.url} preload={autoPlay && active && inView ? "auto" : "none"}
      onLoadedMetadata={begin} onTimeUpdate={() => {
        const audio = player.current;
        if (audio.currentTime >= Math.min(start + duration, audio.duration) - .04) audio.currentTime = start;
      }} onPlay={() => {
        if (playingAudio !== player.current) playingAudio?.pause();
        playingAudio = player.current;
        wanted.current = true;
        setPlaying(true);
      }} onPause={() => {
        if (playingAudio === player.current) playingAudio = undefined;
        setPlaying(false);
      }}
      onEnded={() => {
        player.current.currentTime = start;
        if (active) void player.current.play().catch(() => {});
      }} />
    <button type="button" onClick={toggle} aria-label={`${playing ? "Pause" : "Play"} ${track.title}`}>
      {overlay && style === "audio" ? playing ? <FiPause /> : <FiMusic /> : <>
        <TrackArtwork music={{ ...music, style }} playing={playing} />
        <span className="track-toggle" aria-hidden="true">{playing ? <FiPause /> : <FiPlay />}</span>
      </>}
    </button>
    {track.source && <a href={track.source} className="track-attribution" target="_blank" rel="noopener noreferrer">
      {track.artist} · {track.license}{track.provider === "library" && " · Clip from MP3 conversion"}
    </a>}
  </div>;
}
