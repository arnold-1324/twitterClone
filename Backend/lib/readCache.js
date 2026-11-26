import { performance } from "node:perf_hooks";

export function createReadCache({ maxEntries = 512, ttlMs = 20000, now = () => performance.now() } = {}) {
  const entries = new Map();
  let pending = 0;

  return {
    async read(key, load) {
      const existing = entries.get(key);
      if (existing && (existing.loading || existing.expires > now())) {
        entries.delete(key);
        entries.set(key, existing);
        return existing.promise;
      }
      entries.delete(key);
      if (pending >= 24) {
        throw Object.assign(new Error("The service is busy. Try again shortly."), { status: 503 });
      }
      if (entries.size === maxEntries) {
        for (const [oldKey, entry] of entries) {
          if (!entry.loading) {
            entries.delete(oldKey);
            break;
          }
        }
      }
      if (entries.size >= maxEntries) throw Object.assign(new Error("The cache is busy. Try again shortly."), { status: 503 });
      const entry = { loading: true };
      pending++;
      entry.promise = Promise.resolve().then(load).then((value) => {
        entry.expires = now() + ttlMs;
        return value;
      }).catch((error) => {
        if (entries.get(key) === entry) entries.delete(key);
        throw error;
      }).finally(() => {
        pending--;
        entry.loading = false;
      });
      entries.set(key, entry);
      return entry.promise;
    },
    invalidate(key) {
      entries.delete(key);
    },
    clear() {
      entries.clear();
    },
  };
}

export const peopleCache = createReadCache({ maxEntries: 512, ttlMs: 20000 });
export const postCache = createReadCache({ maxEntries: 256, ttlMs: 15000 });
