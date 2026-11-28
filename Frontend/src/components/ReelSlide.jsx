import { Avatar, Button, Modal, ModalCloseButton, ModalContent, ModalHeader, ModalOverlay, Spinner } from "@chakra-ui/react";
import { useEffect, useRef, useState } from "react";
import { FiHeart, FiMusic, FiPause, FiPlay, FiRotateCcw, FiVolume2, FiVolumeX } from "react-icons/fi";
import { Link } from "react-router-dom";
import Actions from "./Actions";
import AdaptiveVideo from "./AdaptiveVideo";
import CreatorFollow from "./CreatorFollow";
import MusicPlayer from "./MusicPlayer";
import PostCaption from "./PostCaption";
import { apiFetch } from "../lib/apiFetch";

export default function ReelSlide({ post, viewer, muted, setMuted, sheet, setSheet, position, goNext }) {
  const video = useRef(null);
  const slide = useRef(null);
  const likeAction = useRef(null);
  const touch = useRef(null);
  const timeout = useRef(null);
  const [paused, setPaused] = useState(false);
  const [waiting, setWaiting] = useState(true);
  const [failed, setFailed] = useState(false);
  const [ended, setEnded] = useState(false);
  const [heart, setHeart] = useState(0);
  const [attempt, setAttempt] = useState(0);
  const [musicOpen, setMusicOpen] = useState(false);
  const creator = post.postedBy?._id ? post.postedBy : null;
  const media = post.media?.find(({ type }) => type === "video");

  useEffect(() => {
    const element = video.current;
    if (!element) return;
    function sync() {
      if (paused || document.hidden || musicOpen) element.pause();
      else void element.play().catch(() => {});
    }
    element.addEventListener("canplay", sync);
    document.addEventListener("visibilitychange", sync);
    sync();
    return () => {
      element.removeEventListener("canplay", sync);
      document.removeEventListener("visibilitychange", sync);
      element.pause();
    };
  }, [paused, musicOpen, attempt]);

  useEffect(() => {
    if (waiting || paused || ended || failed || musicOpen || creator?._id === viewer?._id) return;
    const request = new AbortController();
    const timer = setTimeout(() => {
      if (!document.hidden) void apiFetch(`/api/posts/${post._id}/view`, { method: "PUT", signal: request.signal }).catch(() => {});
    }, 1000);
    return () => {
      clearTimeout(timer);
      request.abort();
    };
  }, [post._id, waiting, paused, ended, failed, musicOpen, creator?._id, viewer?._id]);

  useEffect(() => () => clearTimeout(timeout.current), []);
  useEffect(() => {
    const viewport = window.visualViewport;
    const element = slide.current;
    if (sheet !== "comments" || !viewport) return;
    const fit = () => element.style.setProperty("--reel-visible-height", `${viewport.height}px`);
    fit();
    viewport.addEventListener("resize", fit);
    return () => {
      viewport.removeEventListener("resize", fit);
      element.style.removeProperty("--reel-visible-height");
    };
  }, [sheet]);

  function replay() {
    if (!video.current) return;
    video.current.currentTime = 0;
    setEnded(false);
    setPaused(false);
    void video.current.play().catch(() => {});
  }

  function handleSurfaceTap(event) {
    if (event.target !== video.current || ended || failed) return;
    const previous = touch.current;
    const now = performance.now();
    clearTimeout(timeout.current);
    if (previous && now - previous.time < 280 && Math.hypot(event.clientX - previous.x, event.clientY - previous.y) < 42) {
      touch.current = null;
      setHeart((value) => value + 1);
      likeAction.current?.like();
      return;
    }
    touch.current = { time: now, x: event.clientX, y: event.clientY };
    timeout.current = setTimeout(() => { touch.current = null; setPaused((value) => !value); }, 280);
  }

  return <div ref={slide} className="reel-slide-content" data-sheet={sheet || undefined}>
    <div className="reel-visual" onClick={handleSurfaceTap}>
      <AdaptiveVideo key={attempt} videoRef={video} eager src={media.url} streamUrl={media.streamUrl}
        aria-label={post.caption || "Reel video"} className="reel-stage-video" controls={false} muted={muted}
        onLoadedMetadata={(event) => {
          const seconds = position.get(post._id) ?? 0;
          if (seconds > 0 && seconds < event.currentTarget.duration) event.currentTarget.currentTime = seconds;
        }}
        onTimeUpdate={(event) => { position.set(post._id, event.currentTarget.currentTime); }}
        onCanPlay={() => { setWaiting(false); setFailed(false); }}
        onWaiting={() => setWaiting(true)} onPlaying={() => setWaiting(false)}
        onEnded={() => { setEnded(true); setWaiting(false); }}
        onError={(event) => {
          const element = event.currentTarget;
          queueMicrotask(() => { if (element.error) { setFailed(true); setWaiting(false); } });
        }} />
      {waiting && !ended && !failed && !paused && <div className="reel-player-status" role="status">
        <Spinner size="sm" aria-label="Loading reel video" />
      </div>}
      {failed && <div className="reel-player-status" role="alert">
        <span>This reel couldn’t play.</span>
        <Button size="sm" onClick={() => { setFailed(false); setWaiting(true); setAttempt((value) => value + 1); }}>Retry video</Button>
      </div>}
      {ended && <div className="reel-player-status">
        <Button size="sm" onClick={replay} leftIcon={<FiRotateCcw />}>Watch again</Button>
        <Button size="sm" variant="ghost" onClick={goNext}>Next reel</Button>
      </div>}
      {heart > 0 && <FiHeart key={heart} className="reel-heart" fill="currentColor" aria-hidden="true" />}
    </div>
    <div className="reel-information">
      <div className="reel-identity">
        {creator ? <>
          <Link className="reel-creator" to={`/${encodeURIComponent(creator.username)}`}>
            <Avatar name={creator.fullName || creator.username} src={creator.profileImg} size="sm" />
            <span><strong>{creator.fullName || creator.username}</strong><small>@{creator.username}</small></span>
          </Link>
          <CreatorFollow creator={creator} />
        </> : <span>Unavailable account</span>}
        <div className="reel-playback-controls">
          <button type="button" aria-label={paused || ended ? "Play reel" : "Pause reel"}
            onClick={() => ended ? replay() : setPaused(!paused)}>{paused || ended ? <FiPlay /> : <FiPause />}</button>
          <button type="button" aria-label={muted ? "Unmute reel" : "Mute reel"} aria-pressed={!muted}
            onClick={() => setMuted(!muted)}>{muted ? <FiVolumeX /> : <FiVolume2 />}</button>
        </div>
      </div>
      <PostCaption text={post.caption} compact />
      {post.music?.id && <button className="reel-audio" type="button" onClick={() => setMusicOpen(true)}>
        <FiMusic /> Listen to track
      </button>}
      <Actions post={post} reel likeActionRef={likeAction} onOverlayChange={setSheet} />
    </div>
    {musicOpen && <Modal isOpen onClose={() => setMusicOpen(false)} isCentered>
      <ModalOverlay /><ModalContent className="reel-audio-dialog">
        <ModalHeader>Reel audio</ModalHeader><ModalCloseButton />
        <MusicPlayer music={post.music} />
      </ModalContent>
    </Modal>}
  </div>;
}
