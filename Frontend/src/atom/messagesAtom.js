// atoms.js
import { defineState } from "../state/store";

export function mergeConversationTheme(conversation, theme) {
  if (!theme || (theme.themeRevision ?? 0) <= (conversation.themeRevision ?? 0)) return conversation;
  return {
    ...conversation,
    snowfall: theme.snowfall,
    backgroundTheme: theme.backgroundTheme ?? conversation.backgroundTheme,
    customBackgroundUrl: theme.customBackgroundUrl === undefined ? conversation.customBackgroundUrl : theme.customBackgroundUrl,
    chatFont: theme.chatFont ?? conversation.chatFont,
    themeRevision: theme.themeRevision,
  };
}

export function mergeConversationPreference(conversation, preference) {
  if (!preference || preference.revision <= (conversation.preference?.revision ?? 0)) return conversation;
  return { ...conversation, preference };
}

export const conversationsAtom = defineState({
    key: "conversationsAtom",
    default: [],
});

export const selectedConversationAtom = defineState({
    key: "selectedConversationAtom",
    default: { _id: "" },
});

export const selectedMsg = defineState({
  key:"selectedMsg",
  default:{ 
    id: "",
    text: '',
    media: null,
    mediaType: null,
    sender: null
  },
});

export const messagesAtom = defineState({
    key:"messagesAtom",
    default:[],
});

export const groupsAtom = defineState({
    key: "groupsAtom",
    default: [],
});

export const selectedGroupAtom = defineState({
    key: "selectedGroupAtom",
    default: null,
});

