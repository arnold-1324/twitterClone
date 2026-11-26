import mongoose from "mongoose";
import Message from "../models/message.model.js";
import Group from "../models/group.model.js";
import { getIO, getRecipientRoom } from "../socket/socket.js";

function groupForMember(conversationId, userId) {
  return Group.findOne({ conversation: conversationId, members: userId, blocked: { $ne: userId } });
}

export async function createPoll(req, res) {
  try {
    const { conversationId, question, options, multiSelect, expiresAt } = req.body;
    const sender = req.user._id;
    const expiry = expiresAt ? new Date(expiresAt) : null;
    if (!mongoose.isObjectIdOrHexString(conversationId)
      || typeof question !== "string" || !question.trim() || question.length > 500
      || !Array.isArray(options) || options.length < 2 || options.length > 10
      || options.some((option) => typeof option !== "string" || !option.trim() || option.length > 200)
      || (expiry && (!Number.isFinite(expiry.getTime()) || expiry <= new Date()))) {
      return res.status(400).json({ message: "Provide a question and 2–10 valid options." });
    }

    const group = await groupForMember(conversationId, sender);
    if (!group) return res.status(404).json({ message: "Group not found" });
    const isOwner = group.owner.equals(sender);
    const isAdmin = group.admins.some((admin) => admin.equals(sender));
    if (!isOwner && (group.permissions.canMessage === "owner"
      || (group.permissions.canMessage === "admins" && !isAdmin))) {
      return res.status(403).json({ message: "You cannot post in this group." });
    }

    const poll = await Message.create({
      conversationId, sender, type: "poll",
      poll: {
        question: question.trim(),
        options: options.map((option) => ({ optionText: option.trim(), votes: [] })),
        multiSelect: multiSelect === true, expiresAt: expiry, totalVotes: 0, closed: false,
      },
    });
    await Group.updateOne({ _id: group._id }, { $addToSet: { messages: poll._id } });
    await poll.populate("sender", "username profileImg");
    const io = getIO();
    for (const member of group.members) {
      const recipient = getRecipientRoom(member);
      if (recipient && !member.equals(sender) && !group.blocked.some((id) => id.equals(member))) {
        io.to(recipient).emit("newGroupMessage", { message: poll, conversationId, groupId: group._id });
      }
    }
    return res.status(201).json({ message: "Poll created successfully", poll });
  } catch (error) {
    console.error("Could not create poll:", error.message);
    return res.status(500).json({ message: "Could not create poll" });
  }
}

export async function vote(req, res) {
  try {
    const { messageId } = req.params;
    const { selectedOptions } = req.body;
    if (!mongoose.isObjectIdOrHexString(messageId)
      || !Array.isArray(selectedOptions) || selectedOptions.length === 0
      || selectedOptions.some((index) => !Number.isInteger(index) || index < 0)) {
      return res.status(400).json({ message: "Select at least one valid option." });
    }
    const userId = req.user._id;
    const selections = new Set(selectedOptions);
    const message = await Message.findOne({ _id: messageId, type: "poll" });
    if (!message || !(await groupForMember(message.conversationId, userId))) {
      return res.status(404).json({ message: "Poll not found" });
    }
    const { poll } = message;
    const now = new Date();
    if (poll.closed || (poll.expiresAt && poll.expiresAt <= now)) {
      return res.status(400).json({ message: "Poll is closed or expired." });
    }
    if ((!poll.multiSelect && selections.size !== 1)
      || selectedOptions.some((index) => index >= poll.options.length)) {
      return res.status(400).json({ message: "Invalid selection for this poll." });
    }

    const options = poll.options.map((option, index) => {
      const votes = option.votes.filter((id) => !id.equals(userId));
      if (selections.has(index)) votes.push(userId);
      return { ...option.toObject(), votes };
    });
    const totalVotes = options.reduce((total, option) => total + option.votes.length, 0);
    const updated = await Message.findOneAndUpdate({
      _id: messageId, __v: message.__v, "poll.closed": false,
      $or: [{ "poll.expiresAt": null }, { "poll.expiresAt": { $gt: now } }],
    }, {
      $set: { "poll.options": options, "poll.totalVotes": totalVotes },
      $inc: { __v: 1 },
    }, { new: true });
    if (!updated) return res.status(409).json({ message: "The poll changed. Refresh and try again." });
    return res.json({ message: "Vote recorded.", poll: updated });
  } catch (error) {
    console.error("Could not record vote:", error.message);
    return res.status(500).json({ message: "Could not record vote" });
  }
}

export async function closePoll(req, res) {
  try {
    const { messageId } = req.params;
    const userId = req.user._id;
    const message = mongoose.isObjectIdOrHexString(messageId)
      && await Message.findOne({ _id: messageId, type: "poll" });
    const group = message && await groupForMember(message.conversationId, userId);
    if (!group) return res.status(404).json({ message: "Poll not found" });
    if (!message.sender.equals(userId) && !group.owner.equals(userId)
      && !group.admins.some((admin) => admin.equals(userId))) {
      return res.status(403).json({ message: "You cannot close this poll." });
    }
    const poll = await Message.findByIdAndUpdate(messageId, {
      $set: { "poll.closed": true },
      $inc: { __v: 1 },
    }, { new: true });
    return res.json({ message: "Poll closed.", poll });
  } catch (error) {
    console.error("Could not close poll:", error.message);
    return res.status(500).json({ message: "Could not close poll" });
  }
}
