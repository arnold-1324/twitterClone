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
  default:{ id: "",
    text: '',
    media: null,
    mediaType: null},
});

export const messagesAtom = atom({
    key:"messagesAtom",
    default:[],
});

