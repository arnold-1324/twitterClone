import { apiFetch, readApiJson } from "../lib/apiFetch.js";
import { useEffect, useRef, useState } from "react";
import { Button, IconButton, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader, ModalOverlay } from "@chakra-ui/react";
import { FiMic, FiMicOff, FiVideo, FiVideoOff } from "react-icons/fi";
import { useSocket } from "./SocketContext";
import useShowToast from "../hooks/useShowToast";

import { CallContext } from "./call.js";

function signal(socket, event, payload) {
  return new Promise((resolve, reject) => {
    socket.timeout(7000).emit(event, payload, (error, reply) => {
      if (error || !reply || reply.error) reject(new Error(reply?.error || "The call service did not respond."));
      else resolve(reply);
    });
  });
}

export function CallProvider({ children }) {
  const { socket } = useSocket();
  const current = useRef(null);
  const localVideo = useRef(null);
  const remoteMedia = useRef(null);
  const [view, setView] = useState(null);
  const showToast = useShowToast();

  function refresh(call, changes) {
    if (current.current !== call) return;
    Object.assign(call, changes);
    setView({ ...call });
  }

  function close(call, notifyPeer = true) {
    if (current.current !== call) return;
    current.current = null;
    if (notifyPeer && socket?.connected && call.id) socket.emit("call:end", { id: call.id });
    clearTimeout(call.connectTimer);
    call.pc?.close();
    call.stream?.getTracks().forEach((track) => track.stop());
    setView(null);
  }

  function fail(call, error) {
    if (current.current !== call) return;
    close(call);
    showToast("Call unavailable", error.message, "error");
  }

  async function getMedia(call) {
    if (!navigator.mediaDevices?.getUserMedia || !window.RTCPeerConnection) {
      throw new Error("Calls require a supported browser and a secure connection.");
    }
    const response = await apiFetch("/api/messages/calls/config", { signal: AbortSignal.timeout(8000) });
    if (!response.ok) throw new Error("Could not load call settings.");
    const { iceServers } = await readApiJson(response);
    if (current.current !== call) return false;
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true,
      video: call.mode === "video" ? { facingMode: "user", width: { ideal: 640 } } : false });
    if (current.current !== call) {
      stream.getTracks().forEach((track) => track.stop());
      return false;
    }
    refresh(call, { stream, iceServers });
    return true;
  }

  function makePeer(call) {
    const pc = new RTCPeerConnection({ iceServers: call.iceServers });
    call.pc = pc;
    call.connectTimer = setTimeout(() => fail(call, new Error("Could not establish a media connection.")), 22000);
    call.candidates = [];
    for (const track of call.stream.getTracks()) pc.addTrack(track, call.stream);
    pc.onicecandidate = ({ candidate }) => {
      if (candidate && current.current === call && socket.connected) {
        socket.emit("call:signal", { id: call.id, candidate: candidate.toJSON() });
      }
    };
    pc.ontrack = ({ streams }) => refresh(call, { remote: streams[0] });
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "connected") {
        clearTimeout(call.connectTimer);
        refresh(call, { status: "connected" });
      }
      if (pc.connectionState === "failed" || pc.connectionState === "disconnected") {
        fail(call, new Error("Media connection lost."));
      }
    };
  }

  async function start(chat, mode) {
    if (current.current) return;
    if (!socket?.connected) {
      showToast("Call unavailable", "Wait for the inbox to reconnect.", "error");
      return;
    }
    const call = { name: chat.username, mode, status: "preparing", chain: Promise.resolve() };
    current.current = call;
    refresh(call, {});
    try {
      if (!(await getMedia(call))) return;
      const result = await signal(socket, "call:start", { conversationId: chat._id, mode });
      if (current.current !== call) {
        if (socket.connected) socket.emit("call:end", { id: result.id });
        return;
      }
      refresh(call, { id: result.id, status: "ringing" });
    } catch (error) {
      fail(call, error);
    }
  }

  async function accept() {
    const call = current.current;
    if (call?.status !== "incoming") return;
    refresh(call, { status: "preparing" });
    try {
      if (!(await getMedia(call))) return;
      makePeer(call);
      await signal(socket, "call:accept", { id: call.id });
      refresh(call, { status: "connecting" });
    } catch (error) {
      fail(call, error);
    }
  }

  useEffect(() => {
    if (!socket) return;
    function incoming({ id, from, mode }) {
      if (current.current) return;
      const call = { id, name: from, mode, status: "incoming", chain: Promise.resolve() };
      current.current = call;
      refresh(call, {});
    }
    function enqueue(id, operation) {
      const call = current.current;
      if (!call || call.id !== id) return;
      call.chain = call.chain.then(async () => {
        if (current.current === call) await operation(call);
      }).catch((error) => fail(call, error));
    }
    function accepted({ id }) {
      enqueue(id, async (call) => {
        makePeer(call);
        refresh(call, { status: "connecting" });
        await call.pc.setLocalDescription(await call.pc.createOffer());
        if (current.current === call) socket.emit("call:signal", { id, description: call.pc.localDescription.toJSON() });
      });
    }
    function relay({ id, candidate, description }) {
      enqueue(id, async (call) => {
        const pc = call.pc;
        if (!pc) return;
        if (description) {
          await pc.setRemoteDescription(description);
          for (const item of call.candidates.splice(0)) await pc.addIceCandidate(item);
          if (description.type === "offer") {
            await pc.setLocalDescription(await pc.createAnswer());
            if (current.current === call) socket.emit("call:signal", { id, description: pc.localDescription.toJSON() });
          }
        } else if (candidate && pc.remoteDescription) await pc.addIceCandidate(candidate);
        else if (candidate && call.candidates.length < 64) call.candidates.push(candidate);
      });
    }
    function ended({ id, reason }) {
      const call = current.current;
      if (call?.id !== id) return;
      close(call, false);
      if (reason !== "Call ended") showToast(reason, undefined, "info");
    }
    function disconnected() {
      if (current.current) close(current.current, false);
    }
    socket.on("call:incoming", incoming);
    socket.on("call:accepted", accepted);
    socket.on("call:signal", relay);
    socket.on("call:ended", ended);
    socket.on("disconnect", disconnected);
    return () => {
      if (current.current) close(current.current);
      socket.off("call:incoming", incoming);
      socket.off("call:accepted", accepted);
      socket.off("call:signal", relay);
      socket.off("call:ended", ended);
      socket.off("disconnect", disconnected);
    };
  // The handlers own each call session and only need rebinding when the socket changes.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socket, showToast]);

  useEffect(() => {
    if (localVideo.current) localVideo.current.srcObject = view?.stream ?? null;
    if (remoteMedia.current) remoteMedia.current.srcObject = view?.remote ?? null;
  }, [view]);

  function toggle(kind) {
    const call = current.current;
    if (!call) return;
    const track = call.stream?.getTracks().find((item) => item.kind === kind);
    if (!track) return;
    track.enabled = !track.enabled;
    refresh(call, { [kind === "audio" ? "muted" : "cameraOff"]: !track.enabled });
  }

  const statuses = { incoming: "Incoming call", preparing: "Requesting media access…",
    ringing: "Ringing…", connecting: "Connecting…", connected: "Connected" };
  return (
    <CallContext.Provider value={{ start, busy: Boolean(view), connected: Boolean(socket) }}>
      {children}
      <Modal isOpen={Boolean(view)} onClose={() => current.current && close(current.current)} isCentered
        closeOnOverlayClick={false} closeOnEsc={false} size={{ base: "full", sm: "lg" }}>
        <ModalOverlay />
        {view && <ModalContent className="dayline-call">
          <ModalHeader>{view.mode === "video" ? "Video" : "Voice"} call · {view.name}</ModalHeader>
          <ModalBody>
            <p role="status">{statuses[view.status]}</p>
            {view.mode === "video" ? <div className="call-video">
              <video ref={remoteMedia} autoPlay playsInline aria-label="Remote video" />
              <video ref={localVideo} autoPlay playsInline muted aria-label="Your camera preview" />
            </div> : <audio ref={remoteMedia} autoPlay />}
          </ModalBody>
          <ModalFooter className="call-actions">
            {view.status === "incoming" ? <Button colorScheme="green" onClick={accept}>Answer</Button> : <>
              {view.stream && <IconButton aria-label={view.muted ? "Unmute microphone" : "Mute microphone"}
                icon={view.muted ? <FiMicOff /> : <FiMic />} onClick={() => toggle("audio")} />}
              {view.stream && view.mode === "video" && <IconButton aria-label={view.cameraOff ? "Turn camera on" : "Turn camera off"}
                icon={view.cameraOff ? <FiVideoOff /> : <FiVideo />} onClick={() => toggle("video")} />}
            </>}
            <Button colorScheme="red" onClick={() => close(current.current)}>
              {view.status === "incoming" ? "Decline" : "End call"}
            </Button>
          </ModalFooter>
        </ModalContent>}
      </Modal>
    </CallContext.Provider>
  );
}
