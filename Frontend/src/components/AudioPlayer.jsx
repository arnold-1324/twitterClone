import React, { useEffect, useRef, useState } from "react";
import WaveSurfer from "wavesurfer.js";

const PlayIcon = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
    <path d="M5 3.5v13l11-6.5-11-6.5z" />
  </svg>
);

const PauseIcon = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
    <path d="M5 3.5h3v13h-3zm7 0h3v13h-3z" />
  </svg>
);

const AudioPlayer = ({ audioUrl }) => {
  const waveRef = useRef(null);
  const wavesurfer = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1);

  const formatTime = (time) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds < 10 ? "0" : ""}${seconds}`;
  };

  useEffect(() => {
    if (waveRef.current) {
      wavesurfer.current = WaveSurfer.create({
        container: waveRef.current,
        waveColor: "#d1d1d1",
        progressColor: "#3897f0",
        cursorColor: "transparent",
        barWidth: 3,
        barGap: 3,
        height: 40,
      });

      wavesurfer.current.load(audioUrl);

      wavesurfer.current.on("ready", () => {
        setDuration(wavesurfer.current.getDuration());
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
      wavesurfer.current && wavesurfer.current.destroy();
    };
  }, [audioUrl]);

  const togglePlay = () => {
    if (wavesurfer.current) {
      wavesurfer.current.playPause();
      setIsPlaying((p) => !p);
    }
  };

  const handlePlaybackSpeedChange = () => {
    let newRate;
    if (playbackRate === 1) newRate = 1.5;
    else if (playbackRate === 1.5) newRate = 2;
    else newRate = 1;

    setPlaybackRate(newRate);
    wavesurfer.current && wavesurfer.current.setPlaybackRate(newRate);
  };

  return (
    <div className="flex items-center gap-3 p-3 rounded-full shadow-md w-full max-w-md bg-white">
      <button
        onClick={togglePlay}
        className="flex items-center justify-center bg-black text-white w-10 h-10 rounded-full"
      >
        {isPlaying ? <PauseIcon /> : <PlayIcon />}
      </button>
      <div ref={waveRef} className="w-full h-10" />
      <button
        onClick={handlePlaybackSpeedChange}
        className="ml-3 px-2 py-1 text-sm bg-gray-200 rounded-full"
      >
        {playbackRate}x
      </button>
      <span className="text-gray-500 text-sm">{formatTime(currentTime)}</span>
    </div>
  );
};

export default AudioPlayer;
