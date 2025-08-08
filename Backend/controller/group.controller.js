import Group from "../models/group.model.js";
import Conversation from "../models/conversation.model.js";
import Message from "../models/message.model.js";
import User from "../models/user.model.js";
import validator from "validator";
import mongoose from "mongoose";
import jwt from "jsonwebtoken";
import { s3, generateFileName } from "../lib/utils/uploader.js";
import { PutObjectCommand } from "@aws-sdk/client-s3";

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


export const createGroup = async (req, res) => {
  try {
    let { name, description, permissions } = req.body;
    const ownerId = req.user._id;
    const ownerIdString = ownerId.toString();
    
    // Get members from request (handling both array and non-array formats)
    let members = req.body['members[]'] || [];
    if (!Array.isArray(members)) {
      members = [members];
    }
    
    name = sanitize(name);
    description = sanitize(description);
    
    if (!name) return res.status(400).json({ error: "Group name is required." });

    // Handle profile image upload
    let profileImage = "";
    if (req.file) {
      const fileUrl = generateFileName();
      const params = {
        Bucket: process.env.BUCKET_NAME,
        Key: fileUrl,
        Body: req.file.buffer,
        ContentType: req.file.mimetype,
      };

      const command = new PutObjectCommand(params);
      await s3.send(command);

      profileImage = `https://${process.env.BUCKET_NAME}.s3.${process.env.REGION}.amazonaws.com/${fileUrl}`;
    }

    // Ensure members is an array
    if (!Array.isArray(members)) members = [];
    
    // Process member IDs
    members = [...new Set(members)]
      .filter(m => isValidId(m))
      .map(id => id.toString());

    // Add owner to members if not already included
    if (!members.includes(ownerIdString)) {
      members.push(ownerIdString);
    }
    
    // For now, admins are just the owner - can be expanded later
    const admins = [ownerIdString];

    // Deduplicate members
    members = [...new Set(members)];

    // Validate we have at least 1 member
    if (members.length === 0) {
      return res.status(400).json({ error: "Group must have at least 1 member" });
    }

    // Create conversation - convert string IDs to ObjectIDs
    const conversation = await Conversation.create({ 
      participants: members.map(id => new Types.ObjectId(id))
    });
    
    // Create the group - convert string IDs to ObjectIDs
    const group = await Group.create({ 
      name, 
      description, 
      profileImage,
      owner: ownerId, 
      members: members.map(id => new Types.ObjectId(id)), 
      admins: admins.map(id => new Types.ObjectId(id)), 
      permissions: permissions || { canMessage: 'all' }, 
      conversation: conversation._id 
    });

    // Populate the group with user details
    const populatedGroup = await Group.findById(group._id)
      .populate('owner', 'username profileImg')
      .populate('members', 'username profileImg')
      .populate('admins', 'username profileImg');

    return res.status(201).json(populatedGroup);
  } catch (err) { 
    console.error("Group creation error:", err);
    handleError(res, err, err.code || 500); 
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

    res.json(groups);
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
    if (!group.members.some(member => member._id.toString() === userId.toString())) {
      return res.status(403).json({ error: "You are not a member of this group." });
    }

    res.json(group);
  } catch (err) { handleError(res, err, err.code); }
};

// Invite user (push into invites array)
export const inviteToGroup = async (req, res) => {
  try {
    const { groupId, userId } = req.body;
    const group = await loadGroup(groupId);
    // Only admins can invite
    requireAdmin(group, req.user._id);

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
    const { groupId } = req.body;
    const userId = req.user._id;
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
    const { groupId } = req.body;
    const userId = req.user._id;
    const group = await loadGroup(groupId);
    if (!group.owner.equals(userId)) return res.status(403).json({ error: "Only owner can delete." });

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
  const { groupId, expiresIn = '7d' } = req.body;
  const userId = req.user._id;
  
  if (!isValidId(groupId)) return res.status(400).json({ error: "Invalid group ID." });
  if (!Group.exists({ _id: groupId, $or: [{ owner: userId }, { admins: userId }] })) {
    return res.status(403).json({ error: "Not allowed." });
  }
  const token = jwt.sign({ groupId }, process.env.JWT_SECRET, { expiresIn });
  res.json({ inviteLink: `${process.env.APP_URL}/join/${token}` });
};

export const joinWithInvite = async (req, res) => {
  try {
    const { token } = req.body;
    const userId = req.user._id;
    
    if (!token || !isValidId(userId)) return res.status(400).json({ error: "Missing token or userId." });
    const { groupId } = jwt.verify(token, process.env.JWT_SECRET);
    const group = await loadGroup(groupId);
    if (!group.members.includes(userId)) group.members.push(userId);
    await group.save();
    res.json({ message: "Joined via invite link." });
  } catch (err) { handleError(res, err, 400); }
};

// Update group details
export const updateGroup = async (req, res) => {
  try {
    const { groupId } = req.params;
    const { name, description } = req.body;
    const userId = req.user._id;

    const group = await loadGroup(groupId);
    requireAdmin(group, userId);

    // Handle profile image upload
    let profileImage = group.profileImage; // Keep existing if no new image
    if (req.file) {
      const fileUrl = generateFileName();
      const params = {
        Bucket: process.env.BUCKET_NAME,
        Key: fileUrl,
        Body: req.file.buffer,
        ContentType: req.file.mimetype,
      };

      const command = new PutObjectCommand(params);
      await s3.send(command);

      profileImage = `https://${process.env.BUCKET_NAME}.s3.${process.env.REGION}.amazonaws.com/${fileUrl}`;
    }

    // Update group
    const updatedGroup = await Group.findByIdAndUpdate(
      groupId,
      {
        name: sanitize(name),
        description: sanitize(description),
        profileImage,
      },
      { new: true }
    )
    .populate('owner', 'username profileImg')
    .populate('members', 'username profileImg')
    .populate('admins', 'username profileImg');

    res.json(updatedGroup);
  } catch (err) { handleError(res, err, err.code); }
};
