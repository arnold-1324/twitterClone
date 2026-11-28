import Message from "../models/message.model.js";
import { saveConversationPreview } from "./conversationPreview.js";
import { encrypt } from "./utils/Msg_encryption/encrypt.js";

const outcomes = {
  completed: "Ended",
  missed: "No answer",
  declined: "Declined",
  canceled: "Canceled",
  failed: "Couldn’t connect",
  offline: "Offline",
  busy: "Busy",
  interrupted: "Connection lost",
};

export async function saveCallHistory(call, outcome, endedAt, durationSeconds) {
  const text = `${call.mode === "video" ? "Video" : "Voice"} call · ${outcomes[outcome]}`;
  const { encryptedData, iv } = encrypt(text);
  const preview = { text: encryptedData, iv };
  const history = {
    conversationId: call.conversationId, sender: call.caller, type: "text", ...preview,
    call: { mode: call.mode, outcome, durationSeconds }, createdAt: endedAt, updatedAt: endedAt,
  };
  // The existing message type keeps the timeline readable on older clients.
  const message = await Message.findOneAndUpdate({ _id: call.historyId }, { $setOnInsert: history }, {
    upsert: true, new: true, timestamps: false, runValidators: true,
  }).lean();
  await saveConversationPreview(message, { text: message.text, iv: message.iv }).catch((error) => {
    console.error("Could not update call preview:", error.message);
  });
  return { ...message, sender: call.callerProfile, text, iv: undefined };
}
