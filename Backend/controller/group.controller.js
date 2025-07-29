import Group from "../models/group.model.js";
import Conversation from "../models/conversation.model.js";
import Message from "../models/message.model.js";
import User from "../models/user.model.js";
import validator from "validator";
import mongoose from "mongoose";
import jwt from "jsonwebtoken";

const { Types } = mongoose;
const isValidId = id => Types.ObjectId.isValid(id);
const sanitize = str => validator.escape(validator.trim(str || ""));

// Centralized error handler
const handleError = (res, err, code = 500) => res.status(code).json({ error: err.message || err });

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

// Create a new group
export const createGroup = async (req, res) => {
  try {
    let { name, description, ownerId, members = [], admins = [], permissions } = req.body;
    name = sanitize(name);
    description = sanitize(description);
    if (!isValidId(ownerId) || !name) return res.status(400).json({ error: "Invalid owner or name." });

    // Ensure uniqueness and validity
    members = Array.from(new Set(members.filter(isValidId)));
    admins = Array.from(new Set(admins.filter(isValidId)));
    if (!members.includes(ownerId)) members.push(ownerId);
    if (!admins.includes(ownerId)) admins.push(ownerId);

    // Create conversation first
    const conversation = await Conversation.create({ participants: members });
    const group = await Group.create({ name, description, owner: ownerId, members, admins, permissions: permissions || { canMessage: 'all' }, conversation: conversation._id });
    return res.status(201).json(group);
  } catch (err) { handleError(res, err, err.code); }
};

// Invite user (push into invites array)
export const inviteToGroup = async (req, res) => {
  try {
    const { groupId, userId } = req.body;
    const group = await loadGroup(groupId);
    // Only admins can invite
    requireAdmin(group, req.body.requesterId);

    if (group.invites.find(i => i.user.equals(userId) && i.status === 'pending') || group.members.includes(userId)) {
      return res.status(400).json({ error: "Already invited or a member." });
    }
    group.invites.push({ user: userId });
    await group.save();
    res.json({ message: "Invite sent." });
  } catch (err) { handleError(res, err, err.code); }
};

// Accept or deny invite
export async function changeInviteStatus(req, res, status) {
  try {
    const { groupId, userId } = req.body;
    const group = await loadGroup(groupId);
    const invite = group.invites.find(i => i.user.equals(userId) && i.status === 'pending');
    if (!invite) return res.status(400).json({ error: "No pending invite." });

    invite.status = status;
    if (status === 'accepted' && !group.members.includes(userId)) group.members.push(userId);
    await group.save();
    res.json({ message: `Invite ${status}.` });
  } catch (err) { handleError(res, err, err.code); }
}
export const acceptInvite = (req, res) => changeInviteStatus(req, res, 'accepted');
export const denyInvite   = (req, res) => changeInviteStatus(req, res, 'denied');

// Leave group
export const leaveGroup = async (req, res) => {
  try {
    const { groupId, userId } = req.body;
    const group = await loadGroup(groupId);
    if (group.owner.equals(userId)) return res.status(400).json({ error: "Owner cannot leave directly." });

    group.members.pull(userId);
    group.admins.pull(userId);
    await group.save();
    res.json({ message: "Left group." });
  } catch (err) { handleError(res, err, err.code); }
};

// Permissions: who can message
export const setGroupPermissions = async (req, res) => {
  try {
    const { groupId, canMessage, requesterId } = req.body;
    const group = await loadGroup(groupId);
    requireAdmin(group, requesterId);

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
    requireAdmin(group, req.body.requesterId);

    if (block) {
      if (!group.blocked.includes(userId)) group.blocked.push(userId);
    } else {
      group.blocked.pull(userId);
    }
    await group.save();
    res.json({ message: block ? "User blocked." : "User unblocked." });
  } catch (err) { handleError(res, err, err.code); }
}
export const blockUserInGroup   = (req, res) => toggleBlock(req, res, true);
export const unblockUserInGroup = (req, res) => toggleBlock(req, res, false);

// Delete group (owner only)
export const deleteGroup = async (req, res) => {
  try {
    const { groupId, requesterId } = req.body;
    const group = await loadGroup(groupId);
    if (!group.owner.equals(requesterId)) return res.status(403).json({ error: "Only owner can delete." });

    await Group.findByIdAndDelete(groupId);
    await Conversation.findByIdAndDelete(group.conversation);
    res.json({ message: "Group deleted." });
  } catch (err) { handleError(res, err, err.code); }
};

// Analytics: top K senders + Jaccard-based suggestions
export const getGroupAnalytics = async (req, res) => {
  try {
    const { groupId } = req.params;
    const topK = parseInt(req.query.topK) || 5;
    const group = await loadGroup(groupId);

    const messages = await Message.aggregate([
      { $match: { conversation: Types.ObjectId(group.conversation) } },
      { $group: { _id: "$sender", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: topK }
    ]);

    const allUsers = await User.find({ _id: { $nin: group.members } });
    const memberContacts = new Set(group.members.flatMap(m => m.contacts || []));
    const suggestions = allUsers.map(u => {
      const c = new Set(u.contacts || []);
      const inter = [...memberContacts].filter(x => c.has(x)).length;
      const un = new Set([...memberContacts, ...c]).size;
      return { user: u._id, score: un ? inter / un : 0 };
    }).sort((a,b) => b.score - a.score).slice(0, topK);

    res.json({ topSenders: messages, suggestions });
  } catch (err) { handleError(res, err, err.code); }
};

// Invite-link generation + join
export const generateInviteLink = (req, res) => {
  const { groupId, expiresIn = '7d', requesterId } = req.body;
  if (!isValidId(groupId)) return res.status(400).json({ error: "Invalid group ID." });
  if (!Group.exists({ _id: groupId, $or: [{ owner: requesterId }, { admins: requesterId }] })) {
    return res.status(403).json({ error: "Not allowed." });
  }
  const token = jwt.sign({ groupId }, process.env.JWT_SECRET, { expiresIn });
  res.json({ inviteLink: `${process.env.APP_URL}/join/${token}` });
};

export const joinWithInvite = async (req, res) => {
  try {
    const { token, userId } = req.body;
    if (!token || !isValidId(userId)) return res.status(400).json({ error: "Missing token or userId." });
    const { groupId } = jwt.verify(token, process.env.JWT_SECRET);
    const group = await loadGroup(groupId);
    if (!group.members.includes(userId)) group.members.push(userId);
    await group.save();
    res.json({ message: "Joined via invite link." });
  } catch (err) { handleError(res, err, 400); }
};
