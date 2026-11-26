import { atom } from "recoil";

const storageKey = "user-threads";
function readAccount() {
  try { return JSON.parse(localStorage.getItem(storageKey)); } catch { return null; }
}

export default atom({
  key: "userAtom",
  default: readAccount(),
  effects: [({ onSet }) => {
    onSet((account) => {
      try {
        if (account) localStorage.setItem(storageKey, JSON.stringify(account));
        else localStorage.removeItem(storageKey);
      } catch { /* The current tab can continue without storage. */ }
    });
  }],
});
