import { defineState } from "../state/store";

const storageKey = "user-threads";
function readAccount() {
  try { return JSON.parse(localStorage.getItem(storageKey)); } catch { return null; }
}

export default defineState({
  key: "userAtom",
  default: readAccount(),
  persist(account) {
      try {
        if (account) localStorage.setItem(storageKey, JSON.stringify(account));
        else localStorage.removeItem(storageKey);
      } catch { /* The current tab can continue without storage. */ }
  },
});
