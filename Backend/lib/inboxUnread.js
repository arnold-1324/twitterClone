import Conversation from "../models/conversation.model.js";
import Group from "../models/group.model.js";
import Message from "../models/message.model.js";
import MessageRead from "../models/messageRead.model.js";
import { beforeCursor } from "./cursorPage.js";
import { getIO, getRecipientRoom } from "../socket/socket.js";

const cursorOf = (message) => `${new Date(message.createdAt).getTime().toString().padStart(15, "0")}.${message._id}`;

export async function groupReadReceipts(messages, conversation, viewer, group) {
  const blocked = new Set((group.blocked ?? []).map(String));
  const others = group.members.filter((id) => String(id) !== String(viewer) && !blocked.has(String(id)));
  const receipt = await MessageRead.findOne({ conversation, user: { $in: others } }).sort({ through: -1 }).select("through").lean();
  if (!receipt) return messages;
  return messages.map((message) => String(message.sender?._id ?? message.sender) === String(viewer)
    && cursorOf(message) <= receipt.through ? { ...message, seen: true } : message);
}

export async function markInboxRead(user, conversation, message, direct, recipients = []) {
  if (!message?.createdAt) return;
  const through = cursorOf(message);
  const filter = { user, conversation };
  let result;
  try {
    result = await MessageRead.updateOne(filter, { $max: { through } }, { upsert: true });
  } catch (error) {
    if (error.code !== 11000) throw error;
    result = await MessageRead.updateOne(filter, { $max: { through } });
  }
  if (!result.modifiedCount && !result.upsertedCount) return;

  if (direct) {
    const earlier = { $lt: message.createdAt };
    const throughId = { $lte: message._id };
    await Promise.all([
      Message.updateMany({
        conversationId: conversation, sender: { $ne: user }, deletedFor: { $ne: user }, seen: { $ne: true },
        $or: [{ createdAt: earlier }, { createdAt: message.createdAt, _id: throughId }],
      }, { $set: { seen: true } }, { timestamps: false }),
      Conversation.updateOne({
        _id: conversation, "lastMessage.sender": { $ne: user }, "lastMessage.seen": { $ne: true },
        $or: [{ "lastMessage.sentAt": earlier }, { "lastMessage.sentAt": message.createdAt, "lastMessage.messageId": throughId }],
      }, { $set: { "lastMessage.seen": true } }, { timestamps: false }),
    ]);
  }
  const io = getIO();
  io?.to(getRecipientRoom(user)).emit("inboxRead");
  const rooms = recipients.map(getRecipientRoom).filter(Boolean);
  if (rooms.length) io?.to(rooms).emit("messagesSeen", { conversationId: conversation });
}

export async function inboxUnread(user) {
  const [direct, groups, states] = await Promise.all([
    Conversation.distinct("_id", { participants: user, kind: { $ne: "group" } }),
    Group.distinct("conversation", { members: user, blocked: { $ne: user }, conversation: { $ne: null } }),
    MessageRead.find({ user }).select("conversation through").lean(),
  ]);
  // Older groups can have conversation records without a kind.
  const legacy = new Set((direct.length ? await Group.distinct("conversation", { conversation: { $in: direct } }) : []).map(String));
  const conversations = [...direct.filter((id) => !legacy.has(String(id))), ...groups];
  const reads = new Map(states.map(({ conversation, through }) => [String(conversation), through]));
  const byConversation = {};
  for (let i = 0; i < conversations.length; i += 100) {
    const batch = conversations.slice(i, i + 100);
    const fallback = batch.filter((id) => !reads.has(String(id)));
    const filters = batch.filter((id) => reads.has(String(id)))
      .map((id) => ({ conversationId: id, ...beforeCursor(reads.get(String(id)), 1) }));
    if (fallback.length) filters.push({ conversationId: { $in: fallback }, seen: { $ne: true } });
    const rows = await Message.aggregate([
      { $match: { sender: { $ne: user }, deletedFor: { $ne: user }, $or: filters } },
      { $group: { _id: "$conversationId", count: { $sum: 1 } } },
    ]).option({ maxTimeMS: 4000 });
    for (const { _id, count } of rows) byConversation[String(_id)] = count;
  }
  return { total: Object.values(byConversation).reduce((sum, count) => sum + count, 0), byConversation };
}
