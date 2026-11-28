import { defineState } from "../state/store";

export default defineState({ key: "inboxUnread", default: { total: 0, byConversation: {} } });
