import React, { useEffect, useRef, useState } from "react";

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

const AudioPlayer = ({ audioUrl, isPlaying, onPlay }) => {
  const audioRef = useRef(null);
  const progressRef = useRef(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.playbackRate = playbackRate;
      if (isPlaying) {
        audioRef.current.play();
      } else {
        audioRef.current.pause();
      }
    }
  }, [isPlaying, playbackRate, audioUrl]);

  const togglePlay = () => {
    if (!isPlaying) {
      onPlay && onPlay();
    } else {
      audioRef.current && audioRef.current.pause();
      onPlay && onPlay(null);
    }
  };

  const handlePause = () => {
    if (isPlaying && onPlay) {
      setTimeout(() => onPlay(null), 0);
    }
  };

  const handlePlaybackSpeedChange = () => {
    let newRate;
    if (playbackRate === 1) newRate = 1.5;
    else if (playbackRate === 1.5) newRate = 2;
    else newRate = 1;
    setPlaybackRate(newRate);
  };

  const handleTimeUpdate = () => {
    setCurrentTime(audioRef.current.currentTime);
  };

  const handleLoadedMetadata = () => {
    setDuration(audioRef.current.duration);
  };

  const handleEnded = () => {
    if (isPlaying && onPlay) {
      setTimeout(() => onPlay(null), 0);
    }
  };

  const formatTime = (time) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds < 10 ? "0" : ""}${seconds}`;
  };

  // Click to seek
  const handleProgressClick = (e) => {
    const rect = progressRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const percent = clickX / rect.width;
    audioRef.current.currentTime = percent * duration;
  };

  return (
    <div className="flex items-center gap-3 p-3 rounded-full shadow-md w-full max-w-md bg-white">
      {/* Play / Pause Button */}
      <button
        onClick={togglePlay}
        className="flex items-center justify-center bg-black text-white w-10 h-10 rounded-full"
      >
        {isPlaying ? <PauseIcon /> : <PlayIcon />}
      </button>

      {/* Audio element */}
      <audio
        ref={audioRef}
        src={audioUrl}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onPause={handlePause}
        onEnded={handleEnded}
      />

      {/* Progress bar */}
      <div
        ref={progressRef}
        onClick={handleProgressClick}
        className="flex-1 h-2 bg-gray-200 rounded-full cursor-pointer relative"
      >
        <div
          className="h-2 bg-blue-500 rounded-full"
          style={{ width: `${(currentTime / duration) * 100 || 0}%` }}
        />
      </div>

      {/* Speed button */}
      <button
        onClick={handlePlaybackSpeedChange}
        className="ml-3 px-2 py-1 text-sm bg-gray-200 rounded-full"
      >
        {playbackRate}x
      </button>

      {/* Time */}
      <span className="text-gray-500 text-sm">{formatTime(currentTime)}</span>
    </div>
  );
};

export default AudioPlayer;
