import { useEffect, useRef, useState } from "react";
import { Avatar, Modal, ModalContent, ModalHeader } from "@chakra-ui/react";
import { FiMaximize, FiMic, FiMicOff, FiMinimize, FiPhone, FiPhoneOff, FiSettings, FiVideo, FiVideoOff, FiVolume2 } from "react-icons/fi";
import { LuMoonStar, LuPartyPopper, LuSnowflake, LuSparkles, LuSwitchCamera, LuZap } from "react-icons/lu";
import { formatCallDuration } from "../context/call.js";

const statusLabels = {
  incoming: "Incoming call",
  preparing: "Requesting access…",
  ringing: "Calling…",
  connecting: "Connecting…",
  connected: "Connected",
};

const videoEffects = [
  { id: "original", label: "Original", Icon: FiVideo },
  { id: "santa", label: "Santa in the snow", Icon: LuSnowflake },
  { id: "halloween", label: "Halloween", Icon: LuMoonStar },
  { id: "newYear", label: "New Year's Eve", Icon: LuPartyPopper },
  { id: "doomsday", label: "Doomsday", Icon: LuZap },
];

export default function CallScreen({ call, onAnswer, onEnd, onToggle, onEnableRingtone, onFlipCamera, onVideoEffect }) {
  const screen = useRef(null);
  const remoteMedia = useRef(null);
  const localVideo = useRef(null);
  const [settings, setSettings] = useState(false);
  const [speaker, setSpeaker] = useState("");
  const [fullScreen, setFullScreen] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [effectsOpen, setEffectsOpen] = useState(false);
  const incoming = call.status === "incoming";
  const video = call.mode === "video";
  const remoteVideo = call.status === "connected" && Boolean(call.remote?.getVideoTracks().length);
  const preview = call.filter?.stream ?? call.stream;
  const cameraControls = video && Boolean(call.stream);
  const cameraReady = call.status === "connected" && !call.videoOperation;

  useEffect(() => {
    if (localVideo.current) localVideo.current.srcObject = preview ?? null;
  }, [preview]);

  useEffect(() => {
    if (remoteMedia.current) remoteMedia.current.srcObject = call.remote ?? null;
  }, [call.remote]);

  useEffect(() => {
    if (call.connectedAt === undefined) return;
    function tick() { setElapsed(Math.floor((performance.now() - call.connectedAt) / 1000)); }
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [call.connectedAt]);

  useEffect(() => {
    if (!settings || !navigator.mediaDevices?.enumerateDevices) return;
    let active = true;
    async function loadDevices() {
      const devices = await navigator.mediaDevices.enumerateDevices().catch(() => []);
      if (active) setSpeaker(devices.find(({ kind, deviceId }) => kind === "audiooutput" && deviceId === "default")?.label ?? "");
    }
    void loadDevices();
    navigator.mediaDevices.addEventListener("devicechange", loadDevices);
    return () => {
      active = false;
      navigator.mediaDevices.removeEventListener("devicechange", loadDevices);
    };
  }, [settings]);

  useEffect(() => {
    function changed() { setFullScreen(document.fullscreenElement === screen.current); }
    document.addEventListener("fullscreenchange", changed);
    return () => document.removeEventListener("fullscreenchange", changed);
  }, []);

  async function toggleFullScreen() {
    try {
      if (document.fullscreenElement === screen.current) await document.exitFullscreen();
      else await screen.current?.requestFullscreen();
    } catch {
      // Mobile browsers can decline fullscreen while the call view still fills the page.
    }
  }

  const status = call.status === "connected" ? formatCallDuration(elapsed) : statusLabels[call.status];
  return <Modal isOpen onClose={onEnd} closeOnEsc={false} closeOnOverlayClick={false} size="full" motionPreset="none">
    <ModalContent ref={screen} className="call-screen" bg="#121920" color="white">
      <ModalHeader className="call-header">
        <div className="call-header-label">
          {video ? <FiVideo aria-hidden="true" /> : <FiPhone aria-hidden="true" />}
          <span>{video ? "Video call" : "Voice call"}</span>
        </div>
        <div className="call-header-tools">
          <button type="button" className="call-control" aria-label="Call devices" aria-expanded={settings}
            onClick={() => setSettings((open) => !open)}><FiSettings /></button>
          {document.fullscreenEnabled && <button type="button" className="call-control"
            aria-label={fullScreen ? "Exit fullscreen" : "Enter fullscreen"} onClick={toggleFullScreen}>
            {fullScreen ? <FiMinimize /> : <FiMaximize />}
          </button>}
        </div>
      </ModalHeader>

      {settings && <section className="call-device-panel" aria-label="Devices">
        <div><FiMic aria-hidden="true" /><span><strong>Microphone</strong>{call.stream?.getAudioTracks()[0]?.label || "System default"}</span></div>
        <div><FiVolume2 aria-hidden="true" /><span><strong>Speaker</strong>{speaker || "System default"}</span></div>
        {video && <div><FiVideo aria-hidden="true" /><span><strong>Camera</strong>{call.stream?.getVideoTracks()[0]?.label || "System default"}</span></div>}
      </section>}

      <div className={`call-stage${remoteVideo ? " call-stage-live" : ""}`}>
        {video ? <video className="call-remote" ref={remoteMedia} autoPlay playsInline aria-label="Remote video" />
          : <audio ref={remoteMedia} autoPlay />}
        <div className="call-identity">
          {!remoteVideo && <Avatar size="xl" name={call.name} src={call.profileImg} className="call-avatar" />}
          <div>
            <h2>{call.name}</h2>
            <p role={call.status === "connected" ? undefined : "status"} aria-label={call.status === "connected" ? "Call duration" : undefined}>{status}</p>
            {onEnableRingtone && <button type="button" className="call-enable-ringtone" onClick={onEnableRingtone}>
              <FiVolume2 aria-hidden="true" /> Enable ringtone
            </button>}
          </div>
        </div>
        {video && <video className={`call-local${call.cameraFacing === "environment" ? " call-local-rear" : ""}`}
          data-readable={call.filter?.effect === "newYear" || undefined}
          ref={localVideo} autoPlay playsInline muted
          hidden={!call.stream || call.cameraOff} aria-label="Your camera preview" />}
      </div>

      {effectsOpen && cameraControls && <section className="call-effects-panel" aria-label="Video filters">
        <strong>Video filters</strong>
        <div className="call-effect-options">
          {videoEffects.map(({ id, label, Icon }) => (
            <button key={id} type="button" aria-pressed={(call.filter?.effect ?? "original") === id}
              disabled={!cameraReady || (call.cameraOff && id !== "original")} onClick={() => onVideoEffect(id)}>
              <Icon aria-hidden="true" /> {label}
            </button>
          ))}
        </div>
        {call.videoOperation === "effect" && <small role="status">Applying video filter…</small>}
        {call.status !== "connected" && <small>Filters are available once the call connects.</small>}
      </section>}

      <div className="call-footer">
        <div className="call-dock" aria-label="Call controls">
          {incoming ? <button type="button" className="call-control call-answer" aria-label="Answer"
            title="Answer" onClick={onAnswer}><FiPhone /></button> : <>
            <button type="button" className="call-control" aria-label={call.muted ? "Unmute microphone" : "Mute microphone"}
              title={call.muted ? "Unmute microphone" : "Mute microphone"} aria-pressed={Boolean(call.muted)} disabled={!call.stream}
              onClick={() => onToggle("audio")}>{call.muted ? <FiMicOff /> : <FiMic />}</button>
            {video && <button type="button" className="call-control" aria-label={call.cameraOff ? "Turn camera on" : "Turn camera off"}
              title={call.cameraOff ? "Turn camera on" : "Turn camera off"} aria-pressed={Boolean(call.cameraOff)}
              disabled={!call.stream || Boolean(call.videoOperation)}
              onClick={() => onToggle("video")}>{call.cameraOff ? <FiVideoOff /> : <FiVideo />}</button>}
            {cameraControls && <>
              <button type="button" className="call-control" aria-label="Flip camera" title="Flip camera"
                disabled={!cameraReady || call.cameraOff} onClick={onFlipCamera}><LuSwitchCamera /></button>
              <button type="button" className="call-control" aria-label="Video filters" title="Video filters"
                aria-expanded={effectsOpen} aria-pressed={Boolean(call.filter)} onClick={() => setEffectsOpen((open) => !open)}>
                <LuSparkles />
              </button>
            </>}
          </>}
          <button type="button" className="call-control call-end" aria-label={incoming ? "Decline" : "End call"}
            title={incoming ? "Decline" : "End call"} onClick={onEnd}><FiPhoneOff /></button>
        </div>
      </div>
    </ModalContent>
  </Modal>;
}
