import mongoose from "mongoose";
import Conversation from "../models/conversation.model.js";
import Group from "../models/group.model.js";

export async function findDirectConversation(userId, recipientId) {
  if (!mongoose.isObjectIdOrHexString(recipientId) || String(userId) === String(recipientId)) return null;
  const candidates = await Conversation.find({
    kind: { $ne: "group" },
    participants: { $size: 2, $all: [userId, recipientId] },
  }).sort({ updatedAt: -1 }).lean();
  if (!candidates.length) return null;
  const groupConversations = new Set((await Group.distinct("conversation", {
    conversation: { $in: candidates.map(({ _id }) => _id) },
  })).map(String));
  return candidates.find(({ _id }) => !groupConversations.has(String(_id))) ?? null;
}

export async function getOrCreateDirect(senderId, recipientId) {
  const existing = await findDirectConversation(senderId, recipientId);
  if (existing) return existing;
  const directKey = [String(senderId), recipientId.toLowerCase()].sort().join(":");
  try {
    return await Conversation.findOneAndUpdate({ directKey }, {
      $setOnInsert: { directKey, kind: "direct", participants: [senderId, recipientId], createdAt: new Date(), updatedAt: new Date() },
    }, { new: true, upsert: true, timestamps: false });
  } catch (error) {
    if (error.code !== 11000) throw error;
    return Conversation.findOne({ directKey });
  }
}

