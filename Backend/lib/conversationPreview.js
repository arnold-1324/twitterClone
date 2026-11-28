import Conversation from "../models/conversation.model.js";

export async function saveConversationPreview(message, preview) {
  const sentAt = message.createdAt;
  await Conversation.updateOne({
    _id: message.conversationId,
    $or: [
      { "lastMessage.sentAt": { $exists: false } },
      { "lastMessage.sentAt": { $lt: sentAt } },
      { "lastMessage.sentAt": sentAt, "lastMessage.messageId": { $lt: message._id } },
    ],
  }, { $set: { lastMessage: { ...preview, sender: message.sender, messageId: message._id, sentAt, seen: false } } });
}
