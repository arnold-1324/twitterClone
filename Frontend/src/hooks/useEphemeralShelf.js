import { useEffect, useSyncExternalStore } from "react";
import { ephemeralEntry, loadEphemeral, updateEphemeral } from "../lib/ephemeralCache";

const bindings = new WeakMap();
const emptySubscribe = () => () => {};

function bind(entry) {
  if (!bindings.has(entry)) bindings.set(entry, {
    subscribe(listener) { entry.listeners.add(listener); return () => entry.listeners.delete(listener); },
    reload: () => loadEphemeral(entry, { force: true }).catch(() => undefined),
    update: (change) => updateEphemeral(entry, change),
  });
  return bindings.get(entry);
}

export default function useEphemeralShelf(path, viewer) {
  // Resolve by key when rendering so the hook can rejoin a cache invalidated by a mutation.
  const entry = ephemeralEntry(viewer, path);
  const { subscribe = emptySubscribe, reload, update } = entry ? bind(entry) : {};
  const snapshot = useSyncExternalStore(subscribe, () => entry?.snapshot);
  const cleared = snapshot?.data === undefined && !snapshot?.error;

  useEffect(() => {
    if (!entry) return;
    void loadEphemeral(entry).catch(() => {});
    const refresh = () => { void loadEphemeral(entry).catch(() => {}); };
    const interval = setInterval(() => {
      if (document.visibilityState === "visible") refresh();
    }, 31000);
    window.addEventListener("focus", refresh);
    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", refresh);
    };
  }, [entry, cleared]);

  useEffect(() => {
    const data = snapshot?.data;
    if (!data) return;
    const items = Array.isArray(data) ? data : [data];
    const now = Date.now();
    const expires = Math.min(...items.map(({ expiresAt }) => Date.parse(expiresAt)).filter((time) => time > now));
    if (!Number.isFinite(expires)) return;
    const timer = setTimeout(() => {
      // Update the list locally even when the client is offline.
      update((current) => Array.isArray(current)
        ? current.filter(({ expiresAt }) => Date.parse(expiresAt) > Date.now())
        : Date.parse(current?.expiresAt) > Date.now() ? current : null);
      void reload();
    }, expires - now + 10);
    return () => clearTimeout(timer);
  }, [snapshot?.data, reload, update]);

  return { ...snapshot, reload, update };
}
