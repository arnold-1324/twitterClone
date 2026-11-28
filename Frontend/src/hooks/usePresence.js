import { useEffect, useState } from "react";
import { useSocket } from "../context/SocketContext";

export default function usePresence() {
  const { onlineUsers, recentlyOffline } = useSocket();
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(interval);
  }, []);

  return (person) => {
    if (person?._id && onlineUsers.includes(person._id)) return { online: true, label: "Active now" };
    const timestamp = recentlyOffline?.get(person?._id) ?? Date.parse(person?.lastActiveAt);
    if (!Number.isFinite(timestamp)) return { online: false };
    const minutes = Math.max(0, Math.floor((now - timestamp) / 60000));
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    const elapsed = days ? `${days}d ago` : hours ? `${hours}h ago` : minutes ? `${minutes}m ago` : "just now";
    return { online: false, label: `Active ${elapsed}` };
  };
}
