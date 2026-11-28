import { useEffect, useRef } from "react";
import { refreshSession } from "../lib/apiFetch.js";

const autoplayThreshold = 0.65;

export default function AdaptiveVideo({ src, streamUrl, playWhenVisible = false, eager = false, videoRef, ...props }) {
  const internalVideo = useRef(null);
  const video = videoRef ?? internalVideo;

  useEffect(() => {
    const element = video.current;
    let player;
    let active = true;
    let initialized = false;
    let retried = false;

    async function initialize() {
      if (initialized) return;
      initialized = true;
      const network = navigator.connection;
      const playlist = network?.saveData ? streamUrl?.replace(/\/master\.m3u8$/, "/low.m3u8") : streamUrl;
      if (!playlist || element.canPlayType("application/vnd.apple.mpegurl")) {
        element.src = playlist || src;
        return;
      }
      try {
        const { default: Hls } = await import("hls.js/light");
        if (!active) return;
        if (!Hls.isSupported()) {
          element.src = src;
          return;
        }
        const saveData = network?.saveData || ["slow-2g", "2g"].includes(network?.effectiveType);
        player = new Hls({
          startLevel: saveData ? 0 : -1,
          capLevelToPlayerSize: true,
          ...(network?.downlink > 0 && { abrEwmaDefaultEstimate: Math.max(300_000, network.downlink * 700_000) }),
        });
        player.on(Hls.Events.ERROR, async (_event, error) => {
          if (!error.fatal) return;
          if (error.response?.code === 401 && !retried) {
            retried = true;
            const refreshed = await refreshSession().catch(() => false);
            if (!active) return;
            if (refreshed) {
              player.loadSource(playlist);
              return;
            }
          }
          player.destroy();
          player = undefined;
          element.src = src;
        });
        player.loadSource(playlist);
        player.attachMedia(element);
      } catch {
        if (active) element.src = src;
      }
    }

    function fallback() {
      if (streamUrl && !player && element.getAttribute("src") !== src) element.src = src;
    }

    const onPlay = () => { void initialize(); };
    element.addEventListener("play", onPlay);
    element.addEventListener("error", fallback);
    const preload = !eager && "IntersectionObserver" in window
      ? new IntersectionObserver(([entry]) => {
        if (entry.isIntersecting) {
          void initialize();
          preload.disconnect();
        }
      }, { rootMargin: "100px" })
      : null;
    preload?.observe(element);
    if (!preload) void initialize();
    return () => {
      active = false;
      preload?.disconnect();
      element.removeEventListener("play", onPlay);
      element.removeEventListener("error", fallback);
      player?.destroy();
      element.removeAttribute("src");
      element.load();
    };
  }, [src, streamUrl, eager, video]);

  useEffect(() => {
    const element = video.current;
    if (!playWhenVisible || !("IntersectionObserver" in window)) return;
    let visible = false;
    const tryAutoplay = () => {
      if (visible && document.visibilityState === "visible") void element.play().catch(() => {});
    };
    const syncPlayback = () => {
      if (visible && document.visibilityState === "visible") tryAutoplay();
      else element.pause();
    };
    const observer = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting && entry.intersectionRatio >= autoplayThreshold;
      syncPlayback();
    }, { threshold: autoplayThreshold });
    observer.observe(element);
    element.addEventListener("canplay", tryAutoplay);
    document.addEventListener("visibilitychange", syncPlayback);
    return () => {
      observer.disconnect();
      element.removeEventListener("canplay", tryAutoplay);
      document.removeEventListener("visibilitychange", syncPlayback);
      element.pause();
    };
  }, [playWhenVisible, src, streamUrl, video]);

  return <video ref={video} controls playsInline muted={playWhenVisible}
    loop={playWhenVisible} preload="metadata" {...props} />;
}
