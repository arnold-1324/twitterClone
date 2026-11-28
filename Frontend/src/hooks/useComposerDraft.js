import { useEffect, useRef, useState } from "react";
import { draftLifetime, readComposerDraft, writeComposerDraft } from "../lib/composerDrafts";

export default function useComposerDraft(userId, kind, source, defaults, hasContent) {
  const key = JSON.stringify([userId, kind, source?.type ?? null, source?.id ?? null]);
  const current = useRef(null);
  const [snapshot, setSnapshot] = useState(null);
  const ready = snapshot?.key === key;
  const value = ready ? snapshot.value : defaults;

  useEffect(() => {
    let cancelled = false;
    function load(record, error = "") {
      if (cancelled) return;
      const next = { key, value: record?.value ?? defaults, expiresAt: record?.expiresAt, error };
      current.current = next;
      setSnapshot(next);
    }
    readComposerDraft(key).then((value) => load(value))
      .catch(() => load(undefined, "Draft storage is unavailable on this device."));
    return () => { cancelled = true; };
  }, [key, defaults]);

  useEffect(() => {
    if (!ready || !snapshot.expiresAt) return;
    const timer = setTimeout(() => {
      if (current.current?.key !== key || current.current.expiresAt !== snapshot.expiresAt) return;
      const empty = { key, value: defaults, error: "" };
      current.current = empty;
      setSnapshot(empty);
    }, Math.max(0, snapshot.expiresAt - Date.now()));
    return () => clearTimeout(timer);
  }, [defaults, key, ready, snapshot]);

  function persist(value, save) {
    const expiresAt = save ? Date.now() + draftLifetime : undefined;
    const next = { key, value, expiresAt, error: "" };
    current.current = next;
    setSnapshot(next);
    if (!userId) return;
    void writeComposerDraft(key, save ? value : null, expiresAt).catch(() => {
      if (current.current === next) setSnapshot({ ...next, error: "Could not save this draft on this device." });
    });
  }

  function set(field, change) {
    if (current.current?.key !== key) return;
    const previous = current.current.value;
    const next = { ...previous, [field]: typeof change === "function" ? change(previous[field]) : change };
    persist(next, hasContent(next));
  }

  function clear() {
    persist(defaults, false);
  }

  return { ready, value, set, clear, hasDraft: hasContent(value), error: ready ? snapshot.error : "" };
}
