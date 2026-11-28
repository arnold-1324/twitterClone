import { useEffect, useRef } from "react";
import { useAppValue } from "../state/store";
import userAtom from "../atom/userAtom";
import { apiFetch, readApiJson } from "../lib/apiFetch";
import { LiveLocationContext } from "./liveLocation";
import { useSocket } from "./SocketContext";

const geolocationOptions = { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 };
const coordinates = ({ coords }) => ({
  latitude: Number(coords.latitude.toFixed(6)),
  longitude: Number(coords.longitude.toFixed(6)),
});

async function updateLocation(messageId, data, signal) {
  const response = await apiFetch(`/api/messages/location/${messageId}`, {
    method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data), signal,
  });
  const result = await readApiJson(response);
  if (!response.ok) throw Object.assign(new Error(result.error || "Could not update your live location."), { status: response.status });
  return result;
}

export default function LiveLocationProvider({ children }) {
  const userId = useAppValue(userAtom)?._id;
  const account = useRef(userId);
  account.current = userId;
  const shares = useRef(new Map());
  const { socket } = useSocket();

  useEffect(() => {
    const active = shares.current;
    return () => {
      for (const close of active.values()) close();
      active.clear();
    };
  }, [userId]);

  useEffect(() => {
    function ended({ messageId, location }) {
      if (location.stoppedAt) shares.current.get(messageId)?.();
    }
    socket?.on("liveLocationUpdated", ended);
    return () => socket?.off("liveLocationUpdated", ended);
  }, [socket]);

  function watch(message, initial) {
    const active = shares.current;
    const expiry = new Date(message.location.expiresAt).getTime();
    if (expiry <= Date.now()) return;
    let pending;
    let timer;
    let inFlight = false;
    let watchId;
    let lastSent = Date.now();
    let lastPosition = initial;
    const controller = new AbortController();
    const expires = setTimeout(close, expiry - Date.now());
    active.set(message._id, close);

    function close() {
      controller.abort();
      if (watchId !== undefined) navigator.geolocation.clearWatch(watchId);
      clearTimeout(expires);
      clearTimeout(timer);
      active.delete(message._id);
    }

    function schedule() {
      if (inFlight || !pending || controller.signal.aborted) return;
      clearTimeout(timer);
      timer = setTimeout(send, Math.max(0, lastSent + 8000 - Date.now()));
    }

    async function send() {
      if (controller.signal.aborted) return;
      const next = pending;
      pending = undefined;
      if (!next || (next.latitude === lastPosition.latitude && next.longitude === lastPosition.longitude)) return;
      inFlight = true;
      lastSent = Date.now();
      try {
        await updateLocation(message._id, next, AbortSignal.any([controller.signal, AbortSignal.timeout(10000)]));
        lastPosition = next;
      } catch (error) {
        if ([401, 403, 404, 410].includes(error.status)) close();
        else pending ??= next;
      } finally {
        inFlight = false;
        schedule();
      }
    }

    watchId = navigator.geolocation.watchPosition((position) => {
      pending = coordinates(position);
      schedule();
    }, () => {}, geolocationOptions);
  }

  async function share(recipient, mode, signal) {
    if (!navigator.geolocation) throw new Error("Location is unavailable in this browser.");
    const position = await new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, (error) => reject(new Error(error.code === 1
        ? "Allow location access in your browser to share your position."
        : "Could not get your position. Check device location and try again.")), geolocationOptions);
    });
    signal.throwIfAborted();
    if (account.current !== userId) throw new Error("Sign in again to share location.");
    const point = coordinates(position);
    const destination = recipient.isGroup ? { groupId: recipient.groupId } : { recipientId: recipient.userId };
    const response = await apiFetch("/api/messages/send", {
      method: "POST", headers: { "Content-Type": "application/json" }, signal: AbortSignal.timeout(10000),
      body: JSON.stringify({ ...destination, location: { mode, ...point } }),
    });
    const message = await readApiJson(response);
    if (!response.ok) throw new Error(message.error || "Could not share your location.");
    if (mode === "live" && account.current === userId) watch(message, point);
    return message;
  }

  async function stop(messageId) {
    shares.current.get(messageId)?.();
    return updateLocation(messageId, { stop: true }, AbortSignal.timeout(10000));
  }

  return <LiveLocationContext.Provider value={{ share, stop }}>{children}</LiveLocationContext.Provider>;
}
