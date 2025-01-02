// atoms.js
import { atom } from "recoil";

export const conversationsAtom = atom({
    key: "conversationsAtom",
    default: [],
});

export const selectedConversationAtom = atom({
    key: "selectedConversationAtom",
    default: { _id: "" },
});

export const selectedMsg =atom({
  key:"selectedMsg",
  default:{ text: '',
    media: null,
    mediaType: null},
});