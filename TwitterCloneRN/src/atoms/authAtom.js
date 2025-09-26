import { atom } from "recoil";

const authScreenAtom = atom({
  key: "authScreenAtom",
  default: "login", // login or signup
});

export default authScreenAtom;