import Group from "../models/group.model.js";
import Conversation from "../models/conversation.model.js";
import ConversationPreference from "../models/conversationPreference.model.js";
import { getIO, getRecipientRoom } from "../socket/socket.js";
import Message from "../models/message.model.js";
import User from "../models/user.model.js";
import validator from "validator";
import mongoose from "mongoose";
import jwt from "jsonwebtoken";
import { mediaUrl, removeMedia, saveMedia } from "../lib/mediaStore.js";
import { presentProfile } from "../lib/utils/presentProfile.js";

const { Types } = mongoose;
const isValidId = id => Types.ObjectId.isValid(id);
const sanitize = str => validator.escape(validator.trim(str || ""));

// Centralized error handler
const handleError = (res, err, code = 500) => {
  const status = err.status || (Number.isInteger(code) && code >= 400 && code < 500 ? code : 500);
  return res.status(status).json({ error: status === 500 ? "Could not complete the group operation." : err.message });
};

// Middleware-like loader
async function loadGroup(groupId) {
  if (!isValidId(groupId)) throw { message: "Invalid group ID.", code: 400 };
  const group = await Group.findById(groupId);
  if (!group) throw { message: "Group not found.", code: 404 };
  return group;
}

// Check admin or owner privileges
function requireAdmin(group, userId) {
  if (!group.admins.some(id => id.equals(userId)) && !group.owner.equals(userId)) {
    throw { message: "Permission denied.", code: 403 };
  }
}


async function presentGroup(group) {
  const data = group.toObject();
  const list = (people) => Promise.all(people.map(presentProfile));
  return {
    ...data, profileImage: await mediaUrl(data.profileImage),
    owner: data.owner?.username ? await presentProfile(data.owner) : data.owner,
    members: data.members?.[0]?.username ? await list(data.members) : data.members,
    admins: data.admins?.[0]?.username ? await list(data.admins) : data.admins,
    conversation: data.conversation?.participants
      ? { ...data.conversation, participants: await list(data.conversation.participants) } : data.conversation,
  };
}

export const createGroup = async (req, res) => {
  const owner = req.user._id;
  const id = new Types.ObjectId();
  let profileImage;
  let conversationCreated = false;
  try {
    const name = typeof req.body.name === "string" ? req.body.name.trim() : "";
    const description = typeof req.body.description === "string" ? req.body.description.trim() : "";
    let members;
    let permissions;
    try {
      members = typeof req.body.members === "string" ? JSON.parse(req.body.members) : req.body.members;
      permissions = typeof req.body.permissions === "string" ? JSON.parse(req.body.permissions) : req.body.permissions;
    } catch {
      return res.status(400).json({ error: "Invalid members or permissions." });
    }
    const canMessage = permissions?.canMessage ?? "all";
    if (!name || name.length > 80 || description.length > 500 || !Array.isArray(members)
      || members.length > 99 || members.some((member) => typeof member !== "string" || !mongoose.isObjectIdOrHexString(member))
      || !["all", "admins", "owner"].includes(canMessage)) {
      return res.status(400).json({ error: "Enter a valid group name, members, and permissions." });
    }
    const memberIds = [...new Set([String(owner), ...members.map((member) => member.toLowerCase())])];
    if (memberIds.length < 2) return res.status(400).json({ error: "Add at least one other person." });
    const people = await User.find({ _id: { $in: memberIds } }).select("username fullName profileImg").lean();
    if (people.length !== memberIds.length) return res.status(400).json({ error: "A selected member no longer exists." });

    if (req.file) {
      ({ key: profileImage } = await saveMedia(req.file, { signal: req.requestAbortSignal, kind: "image", groupId: id }));
    }

    await Conversation.create({ _id: id, kind: "group", participants: memberIds });
    conversationCreated = true;
    const group = await Group.create({
      _id: id, name, description, profileImage, owner, admins: [owner],
      members: memberIds, permissions: { canMessage }, conversation: id,
    });
    const publicPeople = await Promise.all(people.map(presentProfile));
    for (const memberId of memberIds) {
      if (memberId !== String(owner)) getIO()?.to(getRecipientRoom(memberId)).emit("groupCreated");
    }
    return res.status(201).json({
      ...group.toObject(),
      profileImage: await mediaUrl(profileImage),
      members: publicPeople,
      owner: publicPeople.find((person) => person._id.equals(owner)),
      admins: publicPeople.filter((person) => person._id.equals(owner)),
    });
  } catch (error) {
    console.error("Group creation failed:", error.message);
    try {
      if (!(await Group.exists({ _id: id }))) {
        if (conversationCreated) await Conversation.deleteOne({ _id: id });
        if (profileImage) await removeMedia([profileImage]);
      }
    } catch (cleanupError) {
      console.error("Group cleanup failed:", cleanupError.message);
    }
    return handleError(res, error);
  }
};


// Get all groups for a user
export const getUserGroups = async (req, res) => {
  try {
    const userId = req.user._id;
    
    const groups = await Group.find({
      members: userId
    })
    .populate('owner', 'username profileImg')
    .populate('members', 'username profileImg')
    .populate('admins', 'username profileImg')
    .populate({
      path: 'conversation',
      populate: {
        path: 'participants',
        select: 'username profileImg'
      }
    })
    .sort({ createdAt: -1 });

    res.json(await Promise.all(groups.map(presentGroup)));
  } catch (err) { handleError(res, err, err.code); }
};

// Get group details
export const getGroupDetails = async (req, res) => {
  try {
    const { groupId } = req.params;
    const userId = req.user._id;
    
    const group = await Group.findById(groupId)
      .populate('owner', 'username profileImg')
      .populate('members', 'username profileImg')
      .populate('admins', 'username profileImg')
      .populate({
        path: 'conversation',
        populate: {
          path: 'participants',
          select: 'username profileImg'
        }
      });

    if (!group) {
      return res.status(404).json({ error: "Group not found." });
    }

    // Check if user is a member
    if (!group.members.some((member) => member._id.equals(userId)) || group.blocked.some((id) => id.equals(userId))) {
      return res.status(403).json({ error: "You are not a member of this group." });
    }

    res.json(await presentGroup(group));
  } catch (err) { handleError(res, err, err.code); }
};

// Invite user (push into invites array)
export const inviteToGroup = async (req, res) => {
  try {
    const { groupId, userId } = req.body;
    const group = await loadGroup(groupId);
    // Only admins can invite
    requireAdmin(group, req.user._id);

    if (!isValidId(userId) || !(await User.exists({ _id: userId }))) {
      return res.status(400).json({ error: "Choose a valid user." });
    }
    const result = await Group.updateOne({
      _id: group._id, members: { $ne: userId }, blocked: { $ne: userId },
      invites: { $not: { $elemMatch: { user: userId, status: "pending" } } },
    }, { $push: { invites: { user: userId, status: "pending" } } });
    if (!result.modifiedCount) return res.status(409).json({ error: "That person cannot be invited again." });
    res.json({ message: "Invite sent." });
  } catch (err) { handleError(res, err, err.code); }
};

// Accept or deny invite
export async function changeInviteStatus(req, res, status) {
  try {
    const { groupId } = req.body;
    const userId = req.user._id;
    if (!isValidId(groupId)) return res.status(400).json({ error: "Invalid group." });
    const result = await Group.updateOne({
      _id: groupId, blocked: { $ne: userId }, invites: { $elemMatch: { user: userId, status: "pending" } },
    }, {
      $set: { "invites.$.status": status },
      ...(status === "accepted" ? { $addToSet: { members: userId } } : {}),
    });
    if (!result.modifiedCount) return res.status(404).json({ error: "No pending invite." });
    res.json({ message: `Invite ${status}.` });
  } catch (err) { handleError(res, err, err.code); }
}
export const acceptInvite = (req, res) => changeInviteStatus(req, res, 'accepted');
export const denyInvite   = (req, res) => changeInviteStatus(req, res, 'denied');

// Leave group
export const leaveGroup = async (req, res) => {
  try {
    const { groupId } = req.body;
    const userId = req.user._id;
    const group = await loadGroup(groupId);
    if (group.owner.equals(userId)) return res.status(400).json({ error: "Owner cannot leave directly." });

    await Group.updateOne({ _id: group._id }, { $pull: { members: userId, admins: userId } });
    if (group.conversation) getIO()?.in(getRecipientRoom(userId)).socketsLeave(String(group.conversation));
    res.json({ message: "Left group." });
  } catch (err) { handleError(res, err, err.code); }
};

// Permissions: who can message
export const setGroupPermissions = async (req, res) => {
  try {
    const { groupId, canMessage } = req.body;
    const userId = req.user._id;
    const group = await loadGroup(groupId);
    requireAdmin(group, userId);

    const options = ['all', 'admins', 'owner'];
    if (!options.includes(canMessage)) return res.status(400).json({ error: "Invalid permission." });

    group.permissions.canMessage = canMessage;
    await group.save();
    res.json({ message: "Permissions updated." });
  } catch (err) { handleError(res, err, err.code); }
};

// Block/unblock user
async function toggleBlock(req, res, block = true) {
  try {
    const { groupId, userId } = req.body;
    const group = await loadGroup(groupId);
    requireAdmin(group, req.user._id);

    if (!isValidId(userId) || group.owner.equals(userId)) {
      return res.status(400).json({ error: "Choose a valid account other than the owner." });
    }
    await Group.updateOne({ _id: group._id }, block ? { $addToSet: { blocked: userId } } : { $pull: { blocked: userId } });
    if (block && group.conversation) getIO()?.in(getRecipientRoom(userId)).socketsLeave(String(group.conversation));
    res.json({ message: block ? "User blocked." : "User unblocked." });
  } catch (err) { handleError(res, err, err.code); }
}
export const blockUserInGroup   = (req, res) => toggleBlock(req, res, true);
export const unblockUserInGroup = (req, res) => toggleBlock(req, res, false);

// Delete group (owner only)
export const deleteGroup = async (req, res) => {
  try {
    const { groupId } = req.body;
    const userId = req.user._id;
    const group = await loadGroup(groupId);
    if (!group.owner.equals(userId)) return res.status(403).json({ error: "Only owner can delete." });

    if (group.conversation) await Conversation.updateOne({ _id: group.conversation }, { $set: { kind: "group" } });
    await Group.findByIdAndDelete(groupId);
    if (group.conversation) {
      const conversation = await Conversation.findOneAndDelete({ _id: group.conversation, kind: "group" })
        .select("customBackgroundKey").lean();
      if (conversation?.customBackgroundKey) await removeMedia([conversation.customBackgroundKey]);
      await Message.deleteMany({ conversationId: group.conversation });
      await ConversationPreference.deleteMany({ conversation: group.conversation });
    }
    res.json({ message: "Group deleted." });
  } catch (err) { handleError(res, err, err.code); }
};

// Analytics: top K senders + Jaccard-based suggestions
export const getGroupAnalytics = async (req, res) => {
  try {
    const { groupId } = req.params;
    const topK = Math.max(1, Math.min(20, Number.parseInt(req.query.topK, 10) || 5));
    const group = await loadGroup(groupId);
    requireAdmin(group, req.user._id);
    if (!group.conversation) return res.json({ topSenders: [], suggestions: [] });
    const topSenders = await Message.aggregate([
      { $match: { conversationId: group.conversation } },
      { $group: { _id: "$sender", count: { $sum: 1 } } },
      { $sort: { count: -1, _id: 1 } },
      { $limit: topK },
    ]).option({ maxTimeMS: 3000 });
    return res.json({ topSenders, suggestions: [] });
  } catch (err) { handleError(res, err, err.code); }
};

// Invite-link generation + join
export const generateInviteLink = async (req, res) => {
  const { groupId } = req.body;
  const userId = req.user._id;
  
  if (!isValidId(groupId)) return res.status(400).json({ error: "Invalid group ID." });
  if (!(await Group.exists({ _id: groupId, $or: [{ owner: userId }, { admins: userId }] }))) {
    return res.status(403).json({ error: "Not allowed." });
  }
  const token = jwt.sign({ groupId }, process.env.JWT_SECRET, { expiresIn: "7d", audience: "dayline-group-invite" });
  res.json({ inviteLink: `${process.env.APP_URL}/join/${token}` });
};

export const joinWithInvite = async (req, res) => {
  try {
    const { token } = req.body;
    const userId = req.user._id;
    
    if (!token || !isValidId(userId)) return res.status(400).json({ error: "Missing token or userId." });
    const { groupId } = jwt.verify(token, process.env.JWT_SECRET, { audience: "dayline-group-invite" });
    const group = await loadGroup(groupId);
    const joined = await Group.updateOne({ _id: group._id, blocked: { $ne: userId } }, { $addToSet: { members: userId } });
    if (!joined.matchedCount) return res.status(403).json({ error: "Invite unavailable." });
    res.json({ message: "Joined via invite link." });
  } catch (err) { handleError(res, err, 400); }
};

// Update group details
export const updateGroup = async (req, res) => {
  let uploadedKey;
  let persisted = false;
  try {
    const { groupId } = req.params;
    const { name, description } = req.body;
    const userId = req.user._id;
    const group = await loadGroup(groupId);
    requireAdmin(group, userId);

    if (req.file) {
      ({ key: uploadedKey } = await saveMedia(req.file, { signal: req.requestAbortSignal, kind: "image", groupId }));
    }
    const updatedGroup = await Group.findOneAndUpdate(
      { _id: groupId, $or: [{ owner: userId }, { admins: userId }] },
      { $set: {
        ...(name !== undefined && { name: sanitize(name) }),
        ...(description !== undefined && { description: sanitize(description) }),
        ...(uploadedKey && { profileImage: uploadedKey }),
      } },
      { new: true, runValidators: true },
    );
    if (!updatedGroup) throw { message: "Group unavailable.", code: 404 };
    persisted = true;
    await updatedGroup.populate("owner members admins", "username profileImg");
    res.json(await presentGroup(updatedGroup));
  } catch (err) {
    if (uploadedKey && !persisted) await removeMedia([uploadedKey]);
    handleError(res, err, err.code);
  }
};
