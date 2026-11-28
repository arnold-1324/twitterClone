import { apiFetch, readApiJson } from "../lib/apiFetch.js";
import { useEffect, useRef, useState } from "react";
import { useSocket } from "./SocketContext";
import useShowToast from "../hooks/useShowToast";
import useIncomingRingtone from "../hooks/useIncomingRingtone";
import CallScreen from "../components/CallScreen";

import { CallContext } from "./call.js";

const cameraSize = { width: { ideal: 640, max: 960 }, height: { ideal: 480, max: 960 } };

async function openCamera(constraints) {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: { ...cameraSize, ...constraints } });
  return stream.getVideoTracks()[0];
}

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
  const [view, setView] = useState(null);
  const showToast = useShowToast();
  const ringtone = useIncomingRingtone(view?.status === "incoming");

  function refresh(call, changes) {
    if (current.current !== call) return;
    Object.assign(call, changes);
    setView({ ...call });
  }

  function close(call, notifyPeer = true, connectionFailed = false) {
    if (current.current !== call) return;
    current.current = null;
    if (notifyPeer && socket?.connected && call.id) socket.emit("call:end", { id: call.id, connectionFailed });
    clearTimeout(call.connectTimer);
    clearTimeout(call.reconnectTimer);
    call.filterController?.abort();
    call.filter?.stop();
    call.pc?.close();
    call.stream?.getTracks().forEach((track) => track.stop());
    setView(null);
  }

  function fail(call, error) {
    if (current.current !== call) return;
    close(call, true, Boolean(call.pc));
    showToast("Call unavailable", error.message, "error", "top");
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
      video: call.mode === "video" ? { ...cameraSize, facingMode: "user" } : false });
    if (current.current !== call) {
      stream.getTracks().forEach((track) => track.stop());
      return false;
    }
    refresh(call, { stream, iceServers, cameraFacing: stream.getVideoTracks()[0]?.getSettings().facingMode ?? "user" });
    return true;
  }

  function makePeer(call) {
    const pc = new RTCPeerConnection({ iceServers: call.iceServers });
    call.pc = pc;
    call.connectTimer = setTimeout(() => fail(call, new Error("Could not establish a media connection.")), 22000);
    call.candidates = [];
    for (const track of call.stream.getTracks()) {
      const sender = pc.addTrack(track, call.stream);
      if (track.kind === "video") call.videoSender = sender;
    }
    pc.onicecandidate = ({ candidate }) => {
      if (candidate && current.current === call && socket.connected) {
        socket.emit("call:signal", { id: call.id, candidate: candidate.toJSON() });
      }
    };
    pc.ontrack = ({ streams }) => refresh(call, { remote: streams[0] });
    pc.onconnectionstatechange = () => {
      if (current.current !== call) return;
      if (pc.connectionState === "connected") {
        clearTimeout(call.connectTimer);
        clearTimeout(call.reconnectTimer);
        call.reconnectTimer = undefined;
        socket.emit("call:connected", { id: call.id });
        refresh(call, { status: "connected", connectedAt: call.connectedAt ?? performance.now() });
      }
      if (pc.connectionState === "failed") {
        fail(call, new Error("Media connection lost."));
      }
      if (pc.connectionState === "disconnected" && !call.reconnectTimer) {
        call.reconnectTimer = setTimeout(() => fail(call, new Error("Media connection lost.")), 4500);
      }
    };
  }

  async function start(chat, mode) {
    if (current.current) return;
    if (!socket?.connected) {
      showToast("Call unavailable", "Wait for the inbox to reconnect.", "error", "top");
      return;
    }
    const call = { name: chat.username, profileImg: chat.userProfilePic, mode, status: "preparing", chain: Promise.resolve() };
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
      refresh(call, { status: "connecting" });
      await signal(socket, "call:accept", { id: call.id });
    } catch (error) {
      fail(call, error);
    }
  }

  useEffect(() => {
    if (!socket) return;
    function incoming({ id, from, mode, profileImg }) {
      if (current.current) return;
      const call = { id, name: from, profileImg, mode, status: "incoming", chain: Promise.resolve() };
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
      if (reason !== "Call ended") showToast(reason, undefined, "info", "top");
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

  function toggle(kind) {
    const call = current.current;
    if (!call) return;
    const track = call.stream?.getTracks().find((item) => item.kind === kind);
    if (!track) return;
    if (kind === "video") {
      if (call.videoOperation) return;
      if (track.readyState === "ended") {
        void changeCamera(call.cameraFacing, true);
        return;
      }
    }
    track.enabled = !track.enabled;
    if (kind === "video" && call.filter) call.filter.track.enabled = track.enabled;
    refresh(call, { [kind === "audio" ? "muted" : "cameraOff"]: !track.enabled });
  }

  async function installCamera(call, track, facing) {
    if (call.filter) await call.filter.setCamera(track);
    else await call.videoSender.replaceTrack(track);
    if (current.current !== call) return false;
    if (call.filter) call.filter.track.enabled = true;
    const stream = new MediaStream([...call.stream.getAudioTracks(), track]);
    refresh(call, { stream, cameraFacing: facing, cameraOff: false });
    return true;
  }

  async function changeCamera(target, recoverOnly = false) {
    const call = current.current;
    if (!call?.videoSender || call.status !== "connected" || call.videoOperation) return;
    const previous = call.stream.getVideoTracks()[0];
    const source = previous.getSettings();
    const restore = source.deviceId ? { deviceId: { exact: source.deviceId } }
      : { facingMode: { ideal: call.cameraFacing } };
    let replacement;
    refresh(call, { videoOperation: "camera" });
    try {
      const next = recoverOnly ? restore : { facingMode: { exact: target } };
      try {
        replacement = await openCamera(next);
      } catch (error) {
        if (error.name !== "NotReadableError" || current.current !== call) throw error;
        // Some phones can only hold one camera stream at a time.
        previous.stop();
        replacement = await openCamera(next);
      }
      const chosen = replacement.getSettings();
      if (!recoverOnly && ((source.deviceId && chosen.deviceId === source.deviceId)
        || (chosen.facingMode && chosen.facingMode !== target))) {
        throw new Error("The other camera is unavailable.");
      }
      if (current.current !== call || !await installCamera(call, replacement, chosen.facingMode ?? target)) {
        replacement.stop();
        return;
      }
      previous.stop();
    } catch {
      replacement?.stop();
      if (current.current !== call) return;
      let restored = previous;
      try {
        if (previous.readyState === "ended") restored = await openCamera(restore);
        if (current.current !== call || !await installCamera(call, restored, call.cameraFacing)) {
          restored.stop();
          return;
        }
      } catch {
        if (restored !== previous) restored.stop();
        if (call.filter) call.filter.track.enabled = false;
        refresh(call, { cameraOff: true });
      }
      showToast("Camera unavailable", recoverOnly ? "Check that the camera is available and try again."
        : `Could not switch to the ${target === "environment" ? "rear" : "front"} camera.`, "error", "top");
    } finally {
      refresh(call, { videoOperation: undefined });
    }
  }

  async function removeFilter(call) {
    const filter = call.filter;
    if (!filter) return;
    await call.videoSender.replaceTrack(call.stream.getVideoTracks()[0]);
    call.filterController.abort();
    filter.stop();
    refresh(call, { filter: undefined });
  }

  async function setVideoEffect(effect) {
    const call = current.current;
    if (!call?.videoSender || call.status !== "connected" || call.videoOperation || (effect !== "original" && call.cameraOff)
      || effect === (call.filter?.effect ?? "original")) return;
    refresh(call, { videoOperation: "effect" });
    let filter;
    try {
      if (effect === "original") {
        await removeFilter(call);
        return;
      }
      if (call.filter) {
        await call.filter.setEffect(effect);
        return;
      }
      const controller = new AbortController();
      call.filterController = controller;
      const { createVideoEffect } = await import("../lib/videoEffects.js");
      controller.signal.throwIfAborted();
      filter = await createVideoEffect(call.stream.getVideoTracks()[0], effect, controller.signal, () => {
        if (current.current !== call || call.filter !== filter) return;
        void removeFilter(call).catch(() => {});
        showToast("Video filter stopped", "Try selecting the filter again.", "error", "top");
      });
      controller.signal.throwIfAborted();
      await call.videoSender.replaceTrack(filter.track);
      controller.signal.throwIfAborted();
      refresh(call, { filter });
    } catch {
      filter?.stop();
      if (current.current === call) showToast("Video effect unavailable", "Try selecting the filter again.", "error", "top");
    } finally {
      refresh(call, { videoOperation: undefined });
    }
  }

  return (
    <CallContext.Provider value={{ start, busy: Boolean(view), connected: Boolean(socket) }}>
      {children}
      {view && <CallScreen call={view} onAnswer={accept} onToggle={toggle}
        onFlipCamera={() => changeCamera(view.cameraFacing === "environment" ? "user" : "environment")}
        onVideoEffect={setVideoEffect}
        onEnableRingtone={ringtone.needsGesture ? ringtone.enable : undefined}
        onEnd={() => current.current && close(current.current)} />}
    </CallContext.Provider>
  );
}
