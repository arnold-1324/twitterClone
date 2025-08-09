import React, { useEffect, useRef, useState } from "react";
import WaveSurfer from "wavesurfer.js";

const PlayIcon = (props) => (
  <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor" {...props}>
    <path d="M5 3.5v13l11-6.5-11-6.5z" />
  </svg>
);

const PauseIcon = (props) => (
  <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor" {...props}>
    <path d="M5 3.5h3v13h-3zm7 0h3v13h-3z" />
  </svg>
);

export default function AudioPlayerNew({
  audioUrl,
  onPlay,
  onPause,
  onError,
}) {
  const waveRef = useRef(null);
  const wsRef = useRef(null);
  const audioElRef = useRef(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [useFallback, setUseFallback] = useState(false);

  const formatTime = (time) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds < 10 ? "0" : ""}${seconds}`;
  };

  useEffect(() => {
    if (!waveRef.current) return;

    wsRef.current = WaveSurfer.create({
      container: waveRef.current,
      waveColor: "#dbdbdb",
      progressColor: "#0095f6",
      cursorColor: "transparent",
      barWidth: 3,
      barGap: 7,
      barRadius: 2,
      height: 30,
      normalize: true,
      backend: "MediaElement",
      mediaControls: false,
    });

    wsRef.current.load(audioUrl);

    wsRef.current.on("audioprocess", (time) => {
      setCurrentTime(time);
    });

    wsRef.current.on("ready", () => {
      setDuration(wsRef.current.getDuration());
    });

    wsRef.current.on("finish", () => {
      setIsPlaying(false);
    });

    wsRef.current.on("error", (err) => {
      if (err?.name === "AbortError") return; // ignore normal aborts
      console.error("[AudioPlayerNew] WaveSurfer error:", err);
      setUseFallback(true);
      onError?.(err);
    });

    setTimeout(() => {
      wsRef.current.backend?.media?.addEventListener?.("error", (e) => {
        const err = e.error || e;
        if (err?.name === "AbortError") return; // ignore aborts
        console.error("[AudioPlayerNew] MediaElement error", err);
        setUseFallback(true);
        onError?.(err);
      });
    }, 300);

    return () => {
      wsRef.current?.destroy();
    };
  }, [audioUrl]);

  const togglePlay = () => {
    if (useFallback) {
      if (audioElRef.current.paused) {
        audioElRef.current.play();
        onPlay?.();
        setIsPlaying(true);
      } else {
        audioElRef.current.pause();
        onPause?.();
        setIsPlaying(false);
      }
    } else if (wsRef.current) {
      wsRef.current.playPause();
      if (!isPlaying) onPlay?.();
      else onPause?.();
      setIsPlaying(!isPlaying);
    }
  };

  const handlePlaybackSpeedChange = () => {
    const rates = [1, 1.5, 2];
    const newRate = rates[(rates.indexOf(playbackRate) + 1) % rates.length];
    setPlaybackRate(newRate);
    if (useFallback) {
      if (audioElRef.current) audioElRef.current.playbackRate = newRate;
    } else {
      wsRef.current?.setPlaybackRate(newRate);
    }
  };

  const handleFallbackTimeUpdate = () => {
    setCurrentTime(audioElRef.current.currentTime);
  };

  return (
    <div className="flex items-center gap-2 p-2 pl-3 pr-4 w-full max-w-md bg-white rounded-full border border-gray-300">
      <button
        onClick={togglePlay}
        className="flex items-center justify-center w-8 h-8 rounded-full bg-gradient-to-tr from-[#833AB4] via-[#C13584] to-[#E1306C] shadow-sm"
      >
        <div className="flex items-center justify-center w-7 h-7 bg-white rounded-full">
          {isPlaying ? (
            <PauseIcon className="text-black" />
          ) : (
            <PlayIcon className="text-black ml-0.5" />
          )}
        </div>
      </button>

      {/* <div style={{ flex: 1 }}>
        {!useFallback ? (
          <div ref={waveRef} className="flex-1 h-8" />
        ) : (
          <audio
            ref={audioElRef}
            src={audioUrl}
            controls
            onTimeUpdate={handleFallbackTimeUpdate}
            onEnded={() => {
              setIsPlaying(false);
              onPause?.();
            }}
            style={{ width: "100%" }}
          />
        )}
      </div> */}

      <span className="text-xs text-gray-500 font-medium min-w-[35px] text-right">
        {formatTime(currentTime)}
      </span>

      <button
        onClick={handlePlaybackSpeedChange}
        className="text-xs font-medium text-[#0095f6] px-2"
      >
        {playbackRate}x
      </button>
    </div>
  );
}
