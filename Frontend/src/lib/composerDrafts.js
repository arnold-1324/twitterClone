export const draftLifetime = 7 * 24 * 60 * 60 * 1000;
let database;

function open() {
  database ??= new Promise((resolve, reject) => {
    const request = indexedDB.open("social-composer-drafts", 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore("drafts").createIndex("expiresAt", "expiresAt");
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  }).catch((error) => {
    database = undefined;
    throw error;
  });
  return database;
}

async function work(mode, operation) {
  const db = await open();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction("drafts", mode);
    const result = operation(transaction.objectStore("drafts"));
    transaction.oncomplete = () => resolve(result?.result);
    transaction.onabort = () => reject(transaction.error);
  });
}

export async function readComposerDraft(key) {
  return work("readwrite", (store) => {
    const request = store.get(key);
    request.onsuccess = () => {
      if (request.result?.expiresAt <= Date.now()) store.delete(key);
    };
    return request;
  }).then((row) => row?.expiresAt > Date.now() ? row : undefined);
}

export function writeComposerDraft(key, value, expiresAt) {
  return work("readwrite", (store) => value
    ? store.put({ value, expiresAt }, key)
    : store.delete(key));
}

export function purgeComposerDrafts() {
  return work("readwrite", (store) => {
    const cursor = store.index("expiresAt").openKeyCursor(IDBKeyRange.upperBound(Date.now()));
    cursor.onsuccess = () => {
      const item = cursor.result;
      if (!item) return;
      store.delete(item.primaryKey);
      item.continue();
    };
  });
}
