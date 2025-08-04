import React, { useEffect, useRef, useState } from 'react'
import PropTypes from 'prop-types'
import WaveSurfer from 'wavesurfer.js'

const PlayIcon = (props) => (
  <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor" {...props}>
    <path d="M5 3.5v13l11-6.5-11-6.5z" />
  </svg>
)

const PauseIcon = (props) => (
  <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor" {...props}>
    <path d="M5 3.5h3v13h-3zm7 0h3v13h-3z" />
  </svg>
)

const AudioPlayerNew = ({ audioUrl, isPlaying, onPlay }) => {
  const waveRef = useRef(null)
  const wavesurfer = useRef(null)
  const [localPlaying, setLocalPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [playbackRate, setPlaybackRate] = useState(1)

  const formatTime = (time) => {
    const minutes = Math.floor(time / 60)
    const seconds = Math.floor(time % 60)
    return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`
  }

  useEffect(() => {
    if (waveRef.current) {
      wavesurfer.current = WaveSurfer.create({
        container: waveRef.current,
        waveColor: '#dbdbdb',
        progressColor: '#0095f6',
        cursorColor: 'transparent',
        barWidth: 3,
        barGap: 7,
        barRadius: 2,
        height: 30,
        normalize: true
      })

      wavesurfer.current.load(audioUrl)

      wavesurfer.current.on('audioprocess', (time) => {
        setCurrentTime(time)
      })

      wavesurfer.current.on('finish', () => {
        setLocalPlaying(false)
      })
    }

    return () => {
      wavesurfer.current?.destroy()
    }
  }, [audioUrl])

  // Control playback based on isPlaying prop
  useEffect(() => {
    if (!wavesurfer.current) return;
    if (isPlaying) {
      wavesurfer.current.play();
      setLocalPlaying(true);
    } else {
      wavesurfer.current.pause();
      setLocalPlaying(false);
    }
  }, [isPlaying]);

  const handlePlayClick = () => {
    if (!isPlaying && onPlay) {
      onPlay();
    } else if (isPlaying && wavesurfer.current) {
      wavesurfer.current.pause();
    }
  }

  const handlePlaybackSpeedChange = () => {
    const rates = [1, 1.5, 2]
    const newRate = rates[(rates.indexOf(playbackRate) + 1) % rates.length]
    setPlaybackRate(newRate)
    wavesurfer.current?.setPlaybackRate(newRate)
  }

  return (
    <div className="flex items-center gap-2 p-2 pl-3 pr-4 w-full max-w-md bg-white rounded-full border border-gray-300">
      <button
        onClick={handlePlayClick}
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

      <div ref={waveRef} className="flex-1 h-8" />

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
  )
}

AudioPlayerNew.propTypes = {
  audioUrl: PropTypes.string.isRequired,
  isPlaying: PropTypes.bool,
  onPlay: PropTypes.func
}

export default AudioPlayerNew
