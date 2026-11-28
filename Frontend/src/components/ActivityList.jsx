import { Avatar, Button, IconButton, Spinner } from "@chakra-ui/react";
import { useEffect, useState } from "react";
import { FiBell, FiCheck, FiHeart, FiUserPlus, FiX } from "react-icons/fi";
import { Link } from "react-router-dom";
import { useAppState, useAppValue } from "../state/store";
import { apiFetch, readApiJson } from "../lib/apiFetch";
import notifyAtom from "../atom/notifyAtom";
import userAtom from "../atom/userAtom";

export default function ActivityList({ compact = false, onNavigate }) {
  const [feed, setFeed] = useAppState(notifyAtom);
  const user = useAppValue(userAtom);
  const [filter, setFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    const request = new AbortController();
    setLoading(true);
    setError("");
    async function load() {
      try {
        const result = await apiFetch("/api/notification/?markRead=false", { signal: request.signal });
        if (!result.ok) throw new Error("Could not load activity.");
        const notifications = await readApiJson(result);
        if (!Array.isArray(notifications)) throw new Error("Could not load activity.");
        if (!request.signal.aborted) setFeed({ notifications, unreadCount: notifications.filter((item) => !item.read).length });
      } catch (error) {
        if (!request.signal.aborted) setError(error.message);
      } finally {
        if (!request.signal.aborted) setLoading(false);
      }
    }
    load();
    return () => request.abort();
  }, [setFeed, retry, user?._id]);

  async function update(id) {
    if (pending || (!id && !feed.unreadCount)) return;
    setPending(true);
    setError("");
    try {
      const response = id
        ? await apiFetch("/api/notification/delete", {
          method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ notificationId: id }),
        })
        : await apiFetch("/api/notification/read", { method: "PATCH" });
      if (!response.ok) throw new Error("Could not update activity.");
      setFeed(({ notifications }) => {
        const next = id ? notifications.filter((item) => item._id !== id) : notifications.map((item) => ({ ...item, read: true }));
        return { notifications: next, unreadCount: next.filter((item) => !item.read).length };
      });
    } catch (error) {
      setError(error.message);
    } finally {
      setPending(false);
    }
  }
  const items = feed.notifications.filter((item) => filter === "all" || !item.read).slice(0, compact ? 6 : undefined);
  return <section className="activity-list" aria-label="Recent activity">
    <div className="activity-tools">
      <div className="segmented" aria-label="Filter activity">
        <button type="button" aria-pressed={filter === "all"} onClick={() => setFilter("all")}>All</button>
        <button type="button" aria-pressed={filter === "unread"} onClick={() => setFilter("unread")}>Unread</button>
      </div>
      <Button size="xs" variant="ghost" leftIcon={<FiCheck />} onClick={() => update()} aria-disabled={!feed.unreadCount || pending}>
        Mark all read
      </Button>
    </div>
    {loading && <Spinner size="sm" aria-label="Loading activity" />}
    {error && <div className="activity-tools"><p role="alert">{error}</p>
      <Button size="xs" variant="outline" onClick={() => setRetry((value) => value + 1)}>Reload activity</Button></div>}
    {!loading && !items.length && !error && <div className="activity-empty"><FiBell /><p>{filter === "unread" ? "You’re caught up." : "No activity yet."}</p></div>}
    {items.map((item) => {
      const username = item.from?.username;
      const target = item.post?._id && user ? `/${user.username}/post/${item.post._id}` : username && `/${username}`;
      const contents = <>
        <span className="activity-avatar"><Avatar size="sm" name={username} src={item.from?.profileImg} />
          <span>{item.type === "like" ? <FiHeart /> : <FiUserPlus />}</span></span>
        <span className="activity-copy"><strong>{username || "An account"}</strong> {item.type === "like" ? "liked your post" : "started following you"}
          <small>{new Date(item.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</small></span>
      </>;
      return <div key={item._id} className="activity-row" data-unread={!item.read}>
        {target ? <Link to={target} onClick={onNavigate}>{contents}</Link> : <div>{contents}</div>}
        {!item.read && <span className="activity-unread" aria-label="Unread" />}
        {!compact && <IconButton size="xs" variant="ghost" icon={<FiX />} aria-label="Dismiss notification"
          isDisabled={pending} onClick={() => update(item._id)} />}
      </div>;
    })}
  </section>;
}
