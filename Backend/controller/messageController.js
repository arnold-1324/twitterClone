import { beforeCursor, sendCursor } from "../lib/cursorPage.js";
import mongoose from "mongoose";
import moment from "moment";
import { mediaUrl, streamUrl, saveMedia, removeMedia } from "../lib/mediaStore.js";
import { presentPost } from "../lib/utils/presentPost.js";
import { presentProfile } from "../lib/utils/presentProfile.js";
import User from "../models/user.model.js";
import Conversation from "../models/conversation.model.js";
import Message from "../models/message.model.js";
import Group from "../models/group.model.js";
import { belongsToConversation, getIO, getRecipientRoom } from "../socket/socket.js";
import { encrypt, decrypt } from "../lib/utils/Msg_encryption/encrypt.js";
import { redisClient } from "../Redis.js";

async function findDirectConversation(userId, recipientId) {
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

const signMessagePayload = async (msg) => {
  const signedMsg = {
    ...msg,
    img: await mediaUrl(msg.img),
    video: await mediaUrl(msg.video),
    videoStreamUrl: streamUrl(msg.video),
    audio: await mediaUrl(msg.audio),
    file: await mediaUrl(msg.file),
  };

  if (signedMsg.sender && signedMsg.sender.profileImg) {
    signedMsg.sender = {
      ...signedMsg.sender,
      profileImg: await mediaUrl(signedMsg.sender.profileImg),
    };
  }

  if (signedMsg.replyTo) {
    signedMsg.replyTo = {
      ...signedMsg.replyTo,
      img: await mediaUrl(signedMsg.replyTo.img),
      video: await mediaUrl(signedMsg.replyTo.video),
      videoStreamUrl: streamUrl(signedMsg.replyTo.video),
      audio: await mediaUrl(signedMsg.replyTo.audio),
      file: await mediaUrl(signedMsg.replyTo.file),
      sender: signedMsg.replyTo.sender
        ? {
            ...signedMsg.replyTo.sender,
            profileImg: await mediaUrl(signedMsg.replyTo.sender.profileImg),
          }
        : signedMsg.replyTo.sender,
    };
  }

  if (signedMsg.postReference) {
    const post = await presentPost(signedMsg.postReference);
    signedMsg.postReference = { ...post, images: post.imageUrl };
  }

  if (Array.isArray(signedMsg.reactions)) {
    signedMsg.reactions = await Promise.all(
      signedMsg.reactions.map(async (reaction) => ({
        ...reaction,
        user: reaction.user
          ? {
              ...reaction.user,
              profileImg: await mediaUrl(reaction.user.profileImg),
            }
          : reaction.user,
      }))
    );
  }

  return signedMsg;
};

async function getOrCreateDirect(senderId, recipientId) {
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

async function writeMessage(req, res, parentId) {
  const { recipientId, groupId } = req.body;
  const sender = req.user._id;
  const text = typeof req.body.message === "string" ? req.body.message.trim() : "";
  if ((!text && !req.file) || text.length > 4000) {
    return res.status(400).json({ error: "Enter a message of up to 4,000 characters or attach a file." });
  }
  let uploadedKey;
  let persisted = false;
  try {
    let conversation;
    let group;
    if (groupId) {
      if (!mongoose.isObjectIdOrHexString(groupId)) return res.status(400).json({ error: "Invalid group." });
      group = await Group.findOne({ _id: groupId, members: sender, blocked: { $ne: sender } });
      if (!group) return res.status(404).json({ error: "Group unavailable." });
      const owner = group.owner.equals(sender);
      const admin = group.admins.some((id) => id.equals(sender));
      const permissions = group.permissions?.canMessage;
      if (!owner && (permissions === "owner" || (permissions === "admins" && !admin))) {
        return res.status(403).json({ error: "Only group managers can send messages here." });
      }
      if (parentId && !group.conversation) return res.status(404).json({ error: "Conversation unavailable." });
      if (!group.conversation) {
        await Group.updateOne({ _id: group._id, conversation: null }, { $set: { conversation: group._id } });
        group = await Group.findById(group._id);
      }
      conversation = await Conversation.findByIdAndUpdate(group.conversation, {
        $setOnInsert: { kind: "group", participants: group.members, createdAt: new Date(), updatedAt: new Date() },
      }, { upsert: true, new: true, timestamps: false });
    } else {
      if (typeof recipientId !== "string" || !mongoose.isObjectIdOrHexString(recipientId)
        || String(sender) === recipientId.toLowerCase() || !(await User.exists({ _id: recipientId }))) {
        return res.status(400).json({ error: "Choose a valid recipient." });
      }
      conversation = parentId ? await findDirectConversation(sender, recipientId) : await getOrCreateDirect(sender, recipientId);
    }

    let parent;
    if (parentId) {
      if (!conversation) return res.status(404).json({ error: "Conversation unavailable." });
      parent = await Message.findOne({
        _id: parentId, conversationId: conversation._id, deletedFor: { $ne: sender },
      }).select("text iv img video audio file sender").populate("sender", "username profileImg").lean();
      if (!parent) return res.status(404).json({ error: "Parent message unavailable." });
    }

    const encrypted = text ? encrypt(text) : {};
    const data = { sender, conversationId: conversation._id, text: encrypted.encryptedData || "", iv: encrypted.iv };
    if (parent) data.replyTo = parent._id;
    if (req.file) {
      data._id = new mongoose.Types.ObjectId();
      const { key, kind } = await saveMedia(req.file, { conversationId: conversation._id, messageId: data._id });
      uploadedKey = key;
      data[kind === "image" ? "img" : kind] = key;
      data.type = kind;
    }
    const saved = await Message.create(data);
    persisted = true;
    await saveConversationPreview(saved, { text: data.text, iv: data.iv }).catch((error) => {
      console.error("Could not update conversation preview:", error.message);
    });
    await saved.populate("sender", "username profileImg");
    const payload = await signMessagePayload({ ...saved.toObject(), text, iv: undefined,
      replyTo: parent ? { ...parent, text: readMessageText(parent), iv: undefined } : null,
      isGroupMessage: Boolean(group), groupId: group?._id ?? null });
    const io = getIO();
    if (group) {
      const blocked = new Set(group.blocked.map(String));
      for (const member of group.members) {
        if (member.equals(sender) || blocked.has(String(member))) continue;
        io?.to(getRecipientRoom(member)).emit("newGroupMessage", {
          message: payload, groupId: group._id, conversationId: conversation._id,
        });
      }
    } else {
      io?.to(getRecipientRoom(recipientId)).emit("newMessage", payload);
    }
    return res.status(201).json(payload);
  } catch (error) {
    if (uploadedKey && !persisted) await removeMedia([uploadedKey]);
    if (error.status) return res.status(error.status).json({ error: error.message });
    console.error("Could not send message:", error.message);
    return res.status(500).json({ error: "Could not send message." });
  }
}
export const sendMessage = (req, res) => writeMessage(req, res);

function readMessageText(message) {
  if (!message.iv) return message.text;
  try {
    return decrypt({ iv: message.iv, encryptedData: message.text });
  } catch {
    return "[Message unavailable]";
  }
}

export const getMessages = async (req, res, next) => {
  const { otherUserId, groupId } = req.params;
  const userId = req.user._id;
   
  try {
    const cacheKey = `messages:convo:${userId}:${otherUserId  || groupId}`;
    // Redis caching disabled — skip fetching cached messages
    // const cachedMessages = await redisClient.get(cacheKey);
    // if (cachedMessages) {
    //   return res.status(200).json(JSON.parse(cachedMessages));
    // }
    let conversation;
    let isGroupConversation = false;

    if (groupId) {
      // Group conversation
      isGroupConversation = true;

      // Verify user is member of the group
      const group = await Group.findById(groupId);
      if (!group) {
        return res.status(404).json({ error: "Group not found" });
      }

      if (!group.members.includes(userId) || group.blocked.some((id) => id.equals(userId))) {
        return res.status(403).json({ error: "You are not a member of this group" });
      }

      if (!group.conversation) {
        return res.status(404).json({ error: "No conversation found for this group" });
      }

      conversation = await Conversation.findById(group.conversation).lean();
    } else {
      // One-on-one conversation
      conversation = await findDirectConversation(userId, otherUserId);
    }

    if (!conversation) {
      return res.status(404).json({ error: "Conversation not found" });
    }

    const pageRows = await Message.find({ conversationId: conversation._id, deletedFor: { $ne: userId },
      ...beforeCursor(req.query.before),
    }).sort({ createdAt: -1, _id: -1 }).limit(51).maxTimeMS(3000)
      .populate({
        path: 'sender',
        select: 'username profileImg'
      })
      .populate({
        path: 'replyTo',
        select: 'text iv sender video img audio file',
        populate: { path: 'sender', select: 'username profileImg' }
      })
      .populate({
        path: 'postReference',
        select: 'postedBy caption images media kind',
        populate: { path: 'postedBy', select: 'username profileImg' }
      })
      .populate({
        path: 'reactions',
        select: 'user type',
        populate: { path: 'user', select: 'username profileImg' }
      })
      .lean();

    const messages = sendCursor(res, pageRows, 50).reverse();
    const unseenMessages = messages.filter(msg => !msg.seen && String(msg.sender?._id ?? msg.sender) !== String(userId));
    if (unseenMessages.length > 0) {
      await Message.updateMany(
        { _id: { $in: unseenMessages.map(msg => msg._id) } },
        { seen: true }
      );
    }

    if (!req.query.before && conversation.lastMessage?.sender && String(conversation.lastMessage.sender) !== String(userId)) {
      await Conversation.updateOne(
        { _id: conversation._id, "lastMessage.messageId": conversation.lastMessage.messageId ?? null },
        { 'lastMessage.seen': true }
      );
    }

    const decryptedMessages = await Promise.all(messages.map((msg) => signMessagePayload({
      ...msg, text: readMessageText(msg), iv: undefined,
      replyTo: msg.replyTo ? { ...msg.replyTo, text: readMessageText(msg.replyTo), iv: undefined } : null,
      isGroupMessage: isGroupConversation, groupId: groupId || null,
    })));

    const io = getIO();

    if (isGroupConversation) {
      // For group conversations, notify all group members
      const group = await Group.findById(groupId).populate('members');
      const memberIds = group.members
        .filter(member => member._id.toString() !== userId.toString())
        .map(member => member._id.toString());

      memberIds.forEach(memberId => {
        const memberSocketId = getRecipientRoom(memberId);
        if (memberSocketId) {
          io?.to(memberSocketId).emit("messagesSeen", {
            conversationId: conversation._id,
            groupId: groupId
          });
        }
      });
    } else {
      // For one-on-one conversations
      const recipientSocketId = getRecipientRoom(otherUserId);
      if (recipientSocketId) {
        io?.to(recipientSocketId).emit("messagesSeen", { conversationId: conversation._id });
      }
    }
  // Redis disabled: skip storing cached messages
  // await redisClient.setEx(cacheKey, 60, JSON.stringify(decryptedMessages));
    res.status(200).json(decryptedMessages);
  } catch (error) {
    next(error);
  }
};

export const reactTomsg = async (req, res) => {
  try {
    const { messageId, emoji } = req.body;
    const userId = req.user._id;

    if (!mongoose.isObjectIdOrHexString(messageId) || typeof emoji !== "string" || !emoji.trim() || emoji.length > 32) {
      return res.status(400).json({ error: "Message ID and emoji are required" });
    }

    const message = await Message.findById(messageId);
    if (!message || !(await belongsToConversation(message.conversationId, userId))) {
      return res.status(404).json({ error: "Message not found" });
    }

    await Message.updateOne({ _id: messageId }, [{ $set: {
      reactions: { $concatArrays: [
        { $filter: { input: { $ifNull: ["$reactions", []] }, as: "item", cond: { $ne: ["$$item.user", userId] } } },
        [{ _id: new mongoose.Types.ObjectId(), user: userId, type: { $literal: emoji } }],
      ] },
    } }]);
    // Populate reactions with user details
    const populatedMessage = await Message.findById(messageId)
      .populate({
        path: 'reactions',
        select: 'user type',
        populate: { path: 'user', select: 'username profileImg' }
      })
      .populate('conversationId', 'participants');

    if (!populatedMessage) return res.status(404).json({ error: "Message not found" });
    const { members } = await messageAudience(message.conversationId);
    const reactions = populatedMessage.reactions;
    getIO()?.to(members.map(getRecipientRoom)).emit("messageReactionUpdated", { messageId, reactions });
    return res.json({ reactions });
  } catch (error) {
    console.error("Error in reactToMsg:", error.message);
    res.status(500).json({ error: "Internal Server Error" });
  }
};


export const getConversation = async (req, res) => {
  try {
    const currentUserId = req.user._id.toString();
    const cacheKey = `messages:convo:${currentUserId}`;
    // Redis disabled: skip fetching cached conversations
    // const cachedConversations = await redisClient.get(cacheKey);
    // if (cachedConversations) {
    //   return res.status(200).json(JSON.parse(cachedConversations));
    // }
    // 1:1 conversations
    const conversations = await Conversation.find({
      participants: currentUserId,
      kind: { $ne: "group" },
    }).populate({
      path: "participants",
      select: "username profileImg",
    });

    // group conversations where user is a member
    const userGroups = await Group.find({
      members: currentUserId,
      blocked: { $ne: currentUserId },
      conversation: { $exists: true, $ne: null },
    })
      .select("name description profileImage owner admins members conversation")
      .populate({
        path: "conversation",
        populate: {
          path: "participants",
          select: "username profileImg",
        },
      })
      .populate({
        path: "members",
        select: "username profileImg",
      });

    const referencedGroups = new Set((await Group.distinct("conversation", {
      conversation: { $in: conversations.map(({ _id }) => _id) },
    })).map(String));
    // Legacy groups may have conversation records without a kind.
    const convoData = await Promise.all(conversations.filter((convo) => !referencedGroups.has(String(convo._id))).map(async (convo) => {
      const others = convo.participants.filter(
        (p) => p._id.toString() !== currentUserId
      );
      let decryptedText;
      try {
        decryptedText = convo.lastMessage?.iv ? decrypt({
          iv: convo.lastMessage.iv,
          encryptedData: convo.lastMessage.text,
        }) : "";
      } catch {
        decryptedText = "[Decryption failed]";
      }
      return {
        _id: convo._id,
        participants: await Promise.all(others.map(presentProfile)),
        lastMessage: {
          text: decryptedText,
          sender: convo.lastMessage?.sender || null,
          seen: convo.lastMessage?.seen || false,
        },
        updatedAt: convo.updatedAt,
        isGroup: false,
        groupId: null,
      };
    }));

    // map group chats
    const groupConvoData = await Promise.all(userGroups.filter((group) => group.conversation).map(async (group) => {
      let decryptedText;
      try {
        decryptedText = group.conversation.lastMessage?.iv ? decrypt({
          iv: group.conversation.lastMessage.iv,
          encryptedData: group.conversation.lastMessage.text,
        }) : "";
      } catch {
        decryptedText = "[Decryption failed]";
      }
      return {
        _id: group.conversation._id,
        groupInfo: {
          _id: group._id,
          name: group.name,
          description: group.description,
          profileImage: await mediaUrl(group.profileImage),
          owner: group.owner,
          admins: group.admins,
        },
        participants: await Promise.all(group.members.map(presentProfile)),
        lastMessage: {
          text: decryptedText,
          sender: group.conversation.lastMessage?.sender || null,
          seen: group.conversation.lastMessage?.seen || false,
        },
        updatedAt: group.conversation.updatedAt,
        isGroup: true,
        groupId: group._id,
      };
    }));

    
    const merged = [...convoData, ...groupConvoData];
    const uniqueMap = new Map();
    for (const convo of merged) {
      if (!uniqueMap.has(convo._id.toString())) {
        uniqueMap.set(convo._id.toString(), convo);
      } else {
        // If duplicate, prefer isGroup:true
        const existing = uniqueMap.get(convo._id.toString());
        if (!existing.isGroup && convo.isGroup) {
          uniqueMap.set(convo._id.toString(), convo);
        }
      }
    }
    const allConversations = Array.from(uniqueMap.values()).sort(
      (a, b) => new Date(b.updatedAt) - new Date(a.updatedAt)
    );

   
    // Redis disabled: skip storing cached conversations
    // await redisClient.setEx(cacheKey, 60, JSON.stringify(allConversations));
    res.status(200).json(allConversations);
  } catch (error) {
    console.error("Error in getConversation:", error);
    res.status(500).json({ error: "Failed to fetch conversations" });
  }
};


export const getGroupConversationInfo = async (req, res) => {
  const { groupId } = req.params;
  const userId = req.user._id;


  try {
    const cacheKey = `group:info:${groupId}:${userId}`;
    // Redis disabled: skip fetching cached group info
    // const cachedGroupInfo = await redisClient.get(cacheKey);
    // if (cachedGroupInfo) {
    //   return res.status(200).json(JSON.parse(cachedGroupInfo));
    // }
    const group = await Group.findById(groupId)
      .populate('members', 'username profileImg')
      .populate('admins', 'username profileImg')
      .populate('owner', 'username profileImg')
      .populate({
        path: 'conversation',
        populate: {
          path: 'participants',
          select: 'username profileImg'
        }
      });

    if (!group) {
      return res.status(404).json({ error: "Group not found" });
    }

    if (!group.members.some((member) => member._id.equals(userId)) || group.blocked.some((id) => id.equals(userId))) {
      return res.status(403).json({ error: "You are not a member of this group" });
    }

    // Decrypt last message if exists
    let decryptedLastMessage = null;
    if (group.conversation && group.conversation.lastMessage) {
      try {
        decryptedLastMessage = decrypt({
          iv: group.conversation.lastMessage.iv,
          encryptedData: group.conversation.lastMessage.text,
        });
      } catch {
        decryptedLastMessage = "[Decryption failed]";
      }
    }

    const groupInfo = {
      _id: group._id,
      name: group.name,
      description: group.description,
      profileImage: await mediaUrl(group.profileImage),
      owner: group.owner && await presentProfile(group.owner),
      admins: await Promise.all(group.admins.map(presentProfile)),
      members: await Promise.all(group.members.map(presentProfile)),
      permissions: group.permissions,
      conversationId: group.conversation?._id || null,
      lastMessage: decryptedLastMessage ? {
        text: decryptedLastMessage,
        sender: group.conversation.lastMessage.sender,
        seen: group.conversation.lastMessage.seen || false
      } : null,
      updatedAt: group.conversation?.updatedAt || group.updatedAt,
      createdAt: group.createdAt
    };
    // Redis disabled: skip storing cached group info
    // await redisClient.setEx(cacheKey, 300, JSON.stringify(groupInfo));
    res.status(200).json(groupInfo);
  } catch (error) {
    console.error("Error in getGroupConversationInfo:", error.message);
    res.status(500).json({ error: error.message });
  }
};



export async function messageAudience(conversationId) {
  const group = await Group.findOne({ conversation: conversationId }).select("members blocked permissions owner admins").lean();
  if (group) {
    const blocked = new Set(group.blocked.map(String));
    return { group, members: group.members.map(String).filter((id) => !blocked.has(id)) };
  }
  const conversation = await Conversation.findOne({ _id: conversationId, kind: { $ne: "group" } }).select("participants").lean();
  return { members: (conversation?.participants ?? []).map(String) };
}

export const editMessage = async (req, res, next) => {
  const { messageId, newText } = req.body;
  const userId = req.user._id;
  if (!mongoose.isObjectIdOrHexString(messageId) || typeof newText !== "string"
    || !newText.trim() || newText.length > 4000) return res.status(400).json({ error: "Enter a valid message." });
  try {
    const filter = { _id: messageId, sender: userId, type: { $nin: ["poll", "post"] }, deletedFor: { $ne: userId } };
    const original = await Message.findOne(filter).select("conversationId").lean();
    if (!original) return res.status(404).json({ error: "Message not found." });
    const { members, group } = await messageAudience(original.conversationId);
    if (!members.includes(String(userId))) return res.status(404).json({ error: "Message not found." });
    if (group && !group.owner.equals(userId) && (group.permissions?.canMessage === "owner"
      || (group.permissions?.canMessage === "admins" && !group.admins.some((admin) => admin.equals(userId))))) {
      return res.status(403).json({ error: "Only group managers can edit messages here." });
    }
    const text = newText.trim();
    const encrypted = encrypt(text);
    const change = { text: encrypted.encryptedData, iv: encrypted.iv, edited: true };
    const result = await Message.updateOne(filter, { $set: change });
    if (!result.matchedCount) return res.status(404).json({ error: "Message not found." });
    await Conversation.updateOne({
      _id: original.conversationId, "lastMessage.messageId": messageId,
    }, { $set: { "lastMessage.text": change.text, "lastMessage.iv": change.iv } }, { timestamps: false });
    const payload = { _id: messageId, conversationId: original.conversationId, text, edited: true };
    getIO()?.to(members.map(getRecipientRoom)).emit("messageEdited", payload);
    return res.json(payload);
  } catch (error) {
    return next(error);
  }
};

export const sendGroupMessage = sendMessage;

export const replyToMessage = (req, res) => {
  const { messageId } = req.body;
  if (!mongoose.isObjectIdOrHexString(messageId)) return res.status(400).json({ error: "Choose a message to reply to." });
  return writeMessage(req, res, messageId);
};

export const getGroupMessages = async (req, res, next) => {
  const { groupId } = req.params;
  const userId = req.user._id;
  
  try {
    // Verify user is member of the group
    const cacheKey = `group:messages:${groupId}:${userId}`; 
    // Redis disabled: skip fetching cached group messages
    // const cachedMessages = await redisClient.get(cacheKey);
    // if (cachedMessages) {
    //   return res.status(200).json(JSON.parse(cachedMessages));
    // }
    const group = await Group.findById(groupId).lean();
    if (!group) return res.status(404).json({ error: "Group not found" });

    // Normalize membership check (compare strings)
    const memberIdStrings = Array.isArray(group.members)
      ? group.members.map(m => String(m))
      : [];
    if (!memberIdStrings.includes(String(userId)) || group.blocked.some((id) => id.equals(userId))) {
      return res.status(403).json({ error: "You are not a member of this group" });
    }

    if (!group.conversation) {
      return res.status(404).json({ error: "No conversation found for this group" });
    }

    const conversation = await Conversation.findById(group.conversation).lean();
    if (!conversation) {
      return res.status(404).json({ error: "Conversation not found" });
    }

    const pageRows = await Message.find({ conversationId: conversation._id, deletedFor: { $ne: userId },
      ...beforeCursor(req.query.before),
    }).sort({ createdAt: -1, _id: -1 }).limit(51).maxTimeMS(3000)
      .populate({
        path: 'sender',
        select: 'username profileImg'
      })
      .populate({
        path: 'replyTo',
        select: 'text iv sender video img audio file',
        populate: { path: 'sender', select: 'username profileImg' }
      })
      .populate({
        path: 'postReference',
        select: 'postedBy caption images media kind',
        populate: { path: 'postedBy', select: 'username profileImg' }
      })
      .populate({
        path: 'reactions',
        select: 'user type',
        populate: { path: 'user', select: 'username profileImg' }
      })
      .lean();

    const messages = sendCursor(res, pageRows, 50).reverse();
    // Helper to safely get a sender id (works if sender is populated object or raw ObjectId)
    const senderIdOf = (senderField) => {
      if (!senderField) return null;
      // populated sender -> object with _id; raw ObjectId -> use it directly
      return senderField._id ? String(senderField._id) : String(senderField);
    };

    // Find unseen messages (safe checks)
    const unseenMessages = messages.filter(msg => {
      if (msg.seen) return false;
      const sId = senderIdOf(msg.sender);
      // If there is no sender (system message), treat it as not from the user => mark seen
      if (!sId) return true;
      return String(sId) !== String(userId);
    });

    if (unseenMessages.length > 0) {
      await Message.updateMany(
        { _id: { $in: unseenMessages.map(msg => msg._id) } },
        { seen: true }
      );
    }

    // Update conversation.lastMessage.seen only if lastMessage exists and its sender is not the current user
    const lastMsgSenderId = conversation.lastMessage
      ? (conversation.lastMessage.sender?._id
        ? String(conversation.lastMessage.sender._id)
        : String(conversation.lastMessage.sender || ""))
      : null;

    if (!req.query.before && lastMsgSenderId && String(lastMsgSenderId) !== String(userId)) {
      await Conversation.updateOne(
        { _id: conversation._id, "lastMessage.messageId": conversation.lastMessage.messageId ?? null },
        { 'lastMessage.seen': true }
      );
    }

    const decryptedMessages = await Promise.all(messages.map((msg) => signMessagePayload({
      ...msg, text: readMessageText(msg), iv: undefined,
      replyTo: msg.replyTo ? { ...msg.replyTo, text: readMessageText(msg.replyTo), iv: undefined } : null,
      isGroupMessage: true, groupId,
    })));

    // Notify other group members that messages have been seen
    const io = getIO();
    const memberIds = memberIdStrings.filter(idStr => idStr !== String(userId));

    memberIds.forEach(memberId => {
      const memberSocketId = getRecipientRoom(memberId);
      if (memberSocketId) {
        io.to(memberSocketId).emit("messagesSeen", {
          conversationId: conversation._id,
          groupId: groupId
        });
      }
    });
    // Redis caching disabled — skip storing cached messages
    // await redisClient.setEx(cacheKey, 60, JSON.stringify(decryptedMessages));
    res.status(200).json(decryptedMessages);
  } catch (error) {
    next(error);
  }
};


export const deleteMessage = async (req, res, next) => {
  const messageId = req.body?.messageId ?? req.query.messageId;
  const userId = req.user._id;
  if (!mongoose.isObjectIdOrHexString(messageId)) return res.status(400).json({ error: "Invalid message." });
  try {
    const message = await Message.findById(messageId).select("conversationId").lean();
    if (!message || !(await belongsToConversation(message.conversationId, userId))) {
      return res.status(404).json({ error: "Message not found." });
    }
    await Message.updateOne({ _id: messageId }, { $addToSet: { deletedFor: userId } });
    getIO()?.to(getRecipientRoom(userId)).emit("messageDeleted", { messageId });
    return res.json({ success: true });
  } catch (error) {
    return next(error);
  }
};
