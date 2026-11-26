import { apiFetch, readApiJson } from "../lib/apiFetch.js";
import { useCallback, useEffect, useRef, useState } from "react";

export default function usePostPages(url, setPosts) {
  const [cursor, setCursor] = useState("");
  const [loading, setLoading] = useState(Boolean(url));
  const [error, setError] = useState("");
  const [refresh, setRefresh] = useState(0);
  const request = useRef(null);
  const load = useCallback(async (before = "") => {
    if (!url || request.current) return;
    const controller = new AbortController();
    request.current = controller;
    setLoading(true);
    setError("");
    try {
      const response = await apiFetch(before ? `${url}?before=${encodeURIComponent(before)}` : url, { signal: controller.signal });
      if (!response.ok) throw new Error("Could not load posts.");
      const items = await readApiJson(response);
      if (controller.signal.aborted) return;
      setCursor(response.headers.get("X-Next-Cursor") || "");
      setPosts((previous) => before
        ? [...previous, ...items.filter((item) => !previous.some((post) => post._id === item._id))]
        : items);
    } catch (error) {
      if (!controller.signal.aborted) setError(error.message);
    } finally {
      if (request.current === controller) {
        request.current = null;
        setLoading(false);
      }
    }
  }, [url, setPosts]);

  useEffect(() => {
    setCursor("");
    setPosts([]);
    setError("");
    if (url) void load();
    else setLoading(false);
    return () => {
      request.current?.abort();
      request.current = null;
    };
  }, [url, load, setPosts, refresh]);

  return { loading, error, cursor, retry: () => setRefresh((value) => value + 1), loadMore: () => load(cursor) };
}
