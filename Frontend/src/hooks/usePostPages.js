import { apiFetch, readApiJson } from "../lib/apiFetch.js";
import { useEffect, useRef, useState } from "react";

export default function usePostPages(url, setPosts) {
  const [cursor, setCursor] = useState("");
  const [loading, setLoading] = useState(Boolean(url));
  const [error, setError] = useState("");
  const [refresh, setRefresh] = useState(0);
  const request = useRef(null);
  async function load(source, before = "") {
    if (!source || request.current) return;
    const controller = new AbortController();
    request.current = controller;
    setLoading(true);
    setError("");
    try {
      const response = await apiFetch(before ? `${source}${source.includes("?") ? "&" : "?"}before=${encodeURIComponent(before)}` : source, { signal: controller.signal });
      const items = await readApiJson(response);
      if (!response.ok || !Array.isArray(items)) throw new Error(items?.error || "Could not load posts.");
      if (controller.signal.aborted) return;
      setCursor(response.headers.get("X-Next-Cursor") || "");
      setPosts((previous) => {
        if (!before) return items;
        const seen = new Set(previous.map(({ _id }) => _id));
        return [...previous, ...items.filter(({ _id }) => !seen.has(_id))];
      });
    } catch (error) {
      if (!controller.signal.aborted) setError(error.message);
    } finally {
      if (request.current === controller) {
        request.current = null;
        setLoading(false);
      }
    }
  }

  useEffect(() => {
    setCursor("");
    setPosts([]);
    setError("");
    if (url) void load(url);
    else setLoading(false);
    return () => {
      request.current?.abort();
      request.current = null;
    };
  // load uses a request token shared by initial and continued pages.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, setPosts, refresh]);

  return { loading, error, cursor, retry: () => setRefresh((value) => value + 1), loadMore: () => load(url, cursor) };
}
