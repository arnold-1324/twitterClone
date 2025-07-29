import React, { useEffect, useRef, useState } from "react";
import WaveSurfer from "wavesurfer.js";

const PlayIcon = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
    <path d="M5 3.5v13l11-6.5-11-6.5z" />
  </svg>
);

const PauseIcon = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
    <path d="M5 3.5h3v13H5zm7 0h3v13h-3z" />
  </svg>
);

const AudioPlayer = ({ audioUrl }) => {
  const waveRef = useRef(null);
  const wavesurfer = useRef(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  // Helper to format seconds into m:ss format.
  const formatTime = (time) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds < 10 ? "0" : ""}${seconds}`;
  };

  useEffect(() => {
    if (waveRef.current) {
      wavesurfer.current = WaveSurfer.create({
        container: waveRef.current,
        waveColor: "#d1d1d1", // Light gray background wave
        progressColor: "#9b59b6", // Purple progress wave
        cursorColor: "transparent",
        barWidth: 3,
        barGap: 3,
        height: 50, // Increased height for a taller waveform
      });

      wavesurfer.current.load(audioUrl);

      wavesurfer.current.on("ready", () => {
        setDuration(wavesurfer.current.getDuration() || 0);
      });

      wavesurfer.current.on("audioprocess", (time) => {
        setCurrentTime(time);
      });

      wavesurfer.current.on("finish", () => {
        setIsPlaying(false);
        setCurrentTime(0);
      });
    }

    return () => {
      if (wavesurfer.current) wavesurfer.current.destroy();
    };
  }, [audioUrl]);

  const togglePlay = () => {
    if (wavesurfer.current) {
      wavesurfer.current.playPause();
      setIsPlaying(!isPlaying);
    }
  };

  return (
    <div className="flex items-center gap-3 px-4 py-2 rounded-full shadow-md w-full max-w-md bg-white">
      <button
        onClick={togglePlay}
        className="flex items-center justify-center bg-purple-500 text-white w-10 h-10 rounded-full"
      >
        {isPlaying ? <PauseIcon /> : <PlayIcon />}
      </button>
      <div ref={waveRef} className="w-full h-12" />
      <span className="text-black text-sm">
        {formatTime(currentTime) || "0:00"}
      </span>
    </div>
  );
};

export default AudioPlayer;
