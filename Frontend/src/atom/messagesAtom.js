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

export const selectedMsg = atom({
  key:"selectedMsg",
  default:{ 
    id: "",
    text: '',
    media: null,
    mediaType: null,
    sender: null
  },
});

export const messagesAtom = atom({
    key:"messagesAtom",
    default:[],
});

export const groupsAtom = atom({
    key: "groupsAtom",
    default: [],
});

export const selectedGroupAtom = atom({
    key: "selectedGroupAtom",
    default: null,
});

