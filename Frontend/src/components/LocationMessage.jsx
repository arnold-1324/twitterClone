import { useContext, useEffect, useState } from "react";
import { FiExternalLink, FiMapPin, FiRadio } from "react-icons/fi";
import { LiveLocationContext } from "../context/liveLocation";
import useShowToast from "../hooks/useShowToast";

export default function LocationMessage({ message, outgoing, onUpdate }) {
  const service = useContext(LiveLocationContext);
  const toast = useShowToast();
  const [stopping, setStopping] = useState(false);
  const [now, setNow] = useState(Date.now);
  const { mode, latitude, longitude, expiresAt, stoppedAt, updatedAt } = message.location;
  const live = mode === "live";
  const expiry = new Date(expiresAt).getTime();
  const ended = live && (stoppedAt || expiry <= now);
  const located = Number.isFinite(latitude) && Number.isFinite(longitude);

  useEffect(() => {
    if (!expiresAt || stoppedAt) return;
    const timer = setTimeout(() => setNow(Date.now()), Math.max(0, expiry - Date.now()) + 50);
    return () => clearTimeout(timer);
  }, [expiresAt, expiry, stoppedAt]);

  async function stop() {
    setStopping(true);
    try {
      onUpdate?.(await service.stop(message._id));
    } catch (error) {
      toast("Live location", error.message, "error");
    } finally {
      setStopping(false);
    }
  }

  return <div className="location-card">
    <div className="location-heading">
      <span className="location-icon">{live && !ended ? <FiRadio aria-hidden="true" /> : <FiMapPin aria-hidden="true" />}</span>
      <span><strong>{live ? "Live location" : "Current location"}</strong>
        <small>{ended ? "Sharing ended" : live && updatedAt
          ? `Updated ${new Date(updatedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit", second: "2-digit" })}`
          : located ? "Shared in this chat" : "Location unavailable"}</small>
      </span>
    </div>
    {!ended && located && <a href={`https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`}
      target="_blank" rel="noopener noreferrer">Open map <FiExternalLink aria-hidden="true" /></a>}
    {service && outgoing && live && !ended && <button type="button" disabled={stopping} onClick={stop}>
      {stopping ? "Stopping…" : "Stop sharing"}
    </button>}
  </div>;
}
