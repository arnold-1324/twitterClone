import { useEffect } from "react";
import { useSetAppValue } from "../state/store";
import inboxUnreadAtom from "../atom/inboxUnreadAtom";
import { apiFetch, readApiJson } from "../lib/apiFetch";

export default function useInboxUnread(userId, socket) {
  const update = useSetAppValue(inboxUnreadAtom);

  useEffect(() => {
    update({ total: 0, byConversation: {} });
  }, [userId, update]);

  useEffect(() => {
    if (!userId) return;
    let request;
    let timer;
    async function refresh() {
      request?.abort();
      const current = new AbortController();
      request = current;
      try {
        const response = await apiFetch("/api/messages/unread", { signal: current.signal });
        if (!response.ok) return;
        const data = await readApiJson(response);
        if (!current.signal.aborted) update(data);
      } catch {
        // Keep the last count during a disconnect.
      }
    }

    function schedule() {
      timer ??= setTimeout(() => {
        timer = undefined;
        void refresh();
      }, 160);
    }

    const events = ["connect", "newMessage", "newGroupMessage", "inboxRead", "messageDeleted", "groupCreated"];
    for (const event of events) socket?.on(event, schedule);
    window.addEventListener("focus", schedule);
    window.addEventListener("inbox-read", schedule);
    const interval = setInterval(() => {
      if (document.visibilityState === "visible") schedule();
    }, 60000);
    schedule();
    return () => {
      clearTimeout(timer);
      clearInterval(interval);
      request?.abort();
      window.removeEventListener("focus", schedule);
      window.removeEventListener("inbox-read", schedule);
      for (const event of events) socket?.off(event, schedule);
    };
  }, [socket, userId, update]);
}
