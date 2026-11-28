import { useEffect, useRef, useState } from "react";
import { Modal, ModalBody, ModalCloseButton, ModalContent, ModalHeader, ModalOverlay } from "@chakra-ui/react";
import { FiExternalLink, FiPause, FiPlay } from "react-icons/fi";
import { spotifyApi } from "../lib/spotifyEmbed";

export function SpotifyEmbed({ track, active = true, autoPlay = false }) {
  const host = useRef(null);
  const player = useRef(null);
  const [ready, setReady] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [fallback, setFallback] = useState(false);
  const [, kind, id] = track.id.split(":");
  const uri = `spotify:${kind}:${id}`;
  const uriTitle = `Spotify player for ${track.title}`;
  const height = kind === "album" ? 352 : 152;

  useEffect(() => {
    const container = host.current;
    const target = document.createElement("div");
    container.append(target);
    let disposed = false;
    function useFallback() { if (!disposed) setFallback(true); }
    const timeout = setTimeout(useFallback, 11000);
    spotifyApi().then((api) => {
      if (disposed) return;
      api.createController(target, { uri, width: "100%", height }, (controller) => {
        if (disposed) {
          controller.destroy();
          return;
        }
        player.current = controller;
        const frame = container.querySelector("iframe");
        if (frame) frame.title = uriTitle;
        controller.addListener("ready", () => {
          if (disposed) return;
          clearTimeout(timeout);
          setFallback(false);
          setReady(true);
        });
        controller.addListener("playback_update", (event) => {
          if (!disposed) setPlaying(!event.data?.isPaused);
        });
      });
    }).catch(useFallback);

    return () => {
      disposed = true;
      clearTimeout(timeout);
      player.current?.destroy();
      player.current = null;
      container.replaceChildren();
    };
  }, [uri, uriTitle, height]);

  useEffect(() => {
    if (!ready) return;
    if (active && autoPlay) player.current?.play();
    if (!active) player.current?.pause();
  }, [active, autoPlay, ready]);

  function toggle() {
    if (playing) player.current?.pause();
    else player.current?.play();
  }

  return <div className="note-music spotify-player">
    <div ref={host} hidden={fallback} />
    {active && fallback && <iframe title={uriTitle} src={`https://open.spotify.com/embed/${kind}/${id}`} height={height}
      allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" />}
    {active && !ready && !fallback && <small className="note-music-status" role="status">Loading Spotify…</small>}
    <div className="note-player-tools">
      {ready && <button type="button" onClick={toggle}>
        {playing ? <FiPause aria-hidden="true" /> : <FiPlay aria-hidden="true" />}
        {playing ? "Pause" : "Play"} Spotify
      </button>}
      <a href={track.source} target="_blank" rel="noopener noreferrer">Open in Spotify <FiExternalLink aria-hidden="true" /></a>
    </div>
  </div>;
}

export function SpotifyPreview({ track, onClose }) {
  return <Modal isOpen isCentered size="md" onClose={onClose} scrollBehavior="inside">
    <ModalOverlay />
    <ModalContent className="ephemeral-dialog" mx={3} maxH="88dvh">
      <ModalHeader>{track.title}</ModalHeader>
      <ModalCloseButton />
      <ModalBody pb={4}>
        <SpotifyEmbed track={track} autoPlay />
      </ModalBody>
    </ModalContent>
  </Modal>;
}
