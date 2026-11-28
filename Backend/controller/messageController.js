import { findDirectConversation, getOrCreateDirect } from "../lib/directConversation.js";
import { beforeCursor, sendCursor } from "../lib/cursorPage.js";
import mongoose from "mongoose";
import moment from "moment";
import { mediaUrl, streamUrl, saveMedia, removeMedia, describeAttachment } from "../lib/mediaStore.js";
import { presentPost } from "../lib/utils/presentPost.js";
import { presentProfile } from "../lib/utils/presentProfile.js";
import User from "../models/user.model.js";
import Conversation from "../models/conversation.model.js";
import ConversationPreference from "../models/conversationPreference.model.js";
import Message from "../models/message.model.js";
import Group from "../models/group.model.js";
import { belongsToConversation, getIO, getRecipientRoom } from "../socket/socket.js";
import { encrypt, decrypt } from "../lib/utils/Msg_encryption/encrypt.js";
import { redisClient } from "../Redis.js";
import { saveConversationPreview } from "../lib/conversationPreview.js";
import { liveLocationDuration, presentLocation, readCoordinates, sealCoordinates } from "../lib/messageLocation.js";
import { chatBackgrounds, chatFonts } from "../lib/chatBackgrounds.js";
import { findVisibleStory } from "../lib/storyLifetime.js";
import { recordStoryActivity } from "../lib/storyActivity.js";
import { resolveContentReference } from "../lib/contentReference.js";
import Note from "../models/note.model.js";
import { canSeeNote } from "../lib/noteAudience.js";
import { messagePreviews, storyMessagePreview } from "../lib/messagePreviews.js";
import { groupReadReceipts, inboxUnread, markInboxRead } from "../lib/inboxUnread.js";

async function conversationTheme(conversation) {
  return {
    snowfall: Boolean(conversation.snowfall),
    backgroundTheme: conversation.backgroundTheme ?? "default",
    customBackgroundUrl: conversation.customBackgroundKey ? await mediaUrl(conversation.customBackgroundKey) : null,
    chatFont: conversation.chatFont ?? "default",
    themeRevision: conversation.themeRevision ?? 0,
  };
}

const signMessagePayload = async (msg) => {
  const signedMsg = {
    ...msg,
    location: presentLocation(msg.location),
    img: await mediaUrl(msg.img),
    video: await mediaUrl(msg.video),
    videoStreamUrl: streamUrl(msg.video),
    audio: await mediaUrl(msg.audio),
    file: await mediaUrl(msg.file),
    ...(msg.attachments?.length && { type: "bundle", attachments: await Promise.all(msg.attachments.map(async ({ kind, key, attachment }) => ({
      kind, url: await mediaUrl(key), ...(kind === "video" && { streamUrl: streamUrl(key) }), attachment,
    }))) }),
    ...(msg.file && { attachment: msg.attachment?.name ? msg.attachment : await describeAttachment(msg.file) }),
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

async function resolveMentions(text, group, sender) {
  if (!group || !text.includes("@")) return [];
  const names = new Set();
  for (const [, username] of text.matchAll(/(?<![\w.@])@([\w-][\w.@-]{0,63})/g)) {
    names.add(username);
    names.add(username.replace(/\.+$/, ""));
    if (names.size >= 40) break;
  }
  if (!names.size) return [];
  const excluded = new Set([String(sender), ...(group.blocked ?? []).map(String)]);
  const users = await User.find({
    _id: { $in: group.members.filter((id) => !excluded.has(String(id))) },
    username: { $in: [...names] },
  }).select("username").limit(20).lean();
  return users.map(({ _id, username }) => ({ user: _id, username }));
}

async function writeMessage(req, res, parentId) {
  const { recipientId, groupId, location, storyId, sharedStoryId, noteVersion } = req.body ?? {};
  const files = req.files ?? (req.file ? [req.file] : []);
  const hasFiles = files.length > 0;
  const sender = req.user._id;
  const coordinates = location === undefined ? null : readCoordinates(location);
  if (location !== undefined && (!coordinates || !["current", "live"].includes(location.mode) || hasFiles || parentId)) {
    return res.status(400).json({ error: "Choose a valid location to share." });
  }
  const text = coordinates ? (location.mode === "live" ? "Live location" : "Current location")
    : typeof req.body?.message === "string" ? req.body.message.trim() : "";
  const messageText = text || (sharedStoryId ? "Shared a story" : "");
  if ((!messageText && !hasFiles) || messageText.length > 4000) {
    return res.status(400).json({ error: "Enter a message of up to 4,000 characters or attach a file." });
  }
  const uploadedKeys = [];
  let persisted = false;
  try {
    let conversation;
    let group;
    let storyReference;
    let story;
    let note;
    let noteAuthor;
    if (noteVersion !== undefined) {
      const updatedAt = typeof noteVersion === "string" && noteVersion.length <= 30 ? new Date(noteVersion) : null;
      if (!mongoose.isObjectIdOrHexString(recipientId) || !updatedAt || !Number.isFinite(updatedAt.getTime())
        || groupId || parentId || location || hasFiles || storyId || sharedStoryId || !text) {
        return res.status(400).json({ error: "Choose an active note and enter a reply." });
      }
      const account = recipientId.toLowerCase();
      if (canSeeNote(req.user, account)) {
        [note, noteAuthor] = await Promise.all([
          Note.findOne({ _id: account, updatedAt, expiresAt: { $gt: new Date() } }).lean(),
          User.findOne({ _id: account, isFrozen: { $ne: true } }).select("username").lean(),
        ]);
      }
      if (!note || !noteAuthor) {
        return res.status(404).json({ error: "This note is unavailable." });
      }
    }
    if (storyId !== undefined || sharedStoryId !== undefined) {
      const sharing = sharedStoryId !== undefined;
      if (!mongoose.isObjectIdOrHexString(sharing ? sharedStoryId : storyId)
        || (sharing ? storyId !== undefined : !text || groupId) || parentId || location || hasFiles) {
        return res.status(400).json({ error: "Choose a story and a recipient." });
      }
      story = await findVisibleStory(sharing ? sharedStoryId : storyId);
      if (!story || (!sharing && !story.author.equals(recipientId))) return res.status(404).json({ error: "This story is unavailable." });
      const author = await User.findById(story.author).select("username").lean();
      if (!author) return res.status(404).json({ error: "This story is unavailable." });
      const source = story.sharedContent && await resolveContentReference(story.sharedContent);
      storyReference = { id: story._id, username: author.username, purpose: sharing ? "share" : "reply",
        video: story.kind === "video" || source?.media[0]?.type === "video" };
    }
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

    const encrypted = messageText ? encrypt(messageText) : {};
    const data = { sender, conversationId: conversation._id, text: encrypted.encryptedData || "", iv: encrypted.iv };
    if (storyReference) data.storyReference = storyReference;
    if (note) {
      data.noteReply = true;
      data.noteReference = { author: note._id, version: note.updatedAt };
    }
    data.mentions = await resolveMentions(text, group, sender);
    if (coordinates) {
      const now = Date.now();
      data.type = "location";
      data.location = {
        mode: location.mode, ...sealCoordinates(coordinates), updatedAt: new Date(now),
        expiresAt: location.mode === "live" ? new Date(now + liveLocationDuration) : undefined,
      };
    }
    if (parent) data.replyTo = parent._id;
    if (hasFiles) {
      data._id = new mongoose.Types.ObjectId();
      const parts = [];
      for (const file of files) {
        const stored = await saveMedia(file, { signal: req.requestAbortSignal, conversationId: conversation._id, messageId: data._id });
        uploadedKeys.push(stored.key);
        parts.push(stored);
      }
      if (parts.length === 1) {
        const [{ key, kind, attachment }] = parts;
        data[kind === "image" ? "img" : kind] = key;
        data.type = kind;
        if (attachment) data.attachment = attachment;
      } else {
        data.type = "file";
        data.attachments = parts;
      }
    }
    const saved = await Message.create(data);
    persisted = true;
    if (story) await recordStoryActivity(story, sender, sharedStoryId ? "shared" : "replied")
      .catch((error) => console.error("Story message activity:", error.message));
    const summary = !messageText && data.attachments?.length ? encrypt(`${files.length} attachments`) : null;
    await saveConversationPreview(saved, { text: summary?.encryptedData ?? data.text, iv: summary?.iv ?? data.iv, mentionedUsers: data.mentions.map(({ user }) => user) }).catch((error) => {
      console.error("Could not update conversation preview:", error.message);
    });
    await saved.populate("sender", "username profileImg");
    const payload = await signMessagePayload({ ...saved.toObject(), text: messageText, iv: undefined,
      ...(story && { storyPreview: await storyMessagePreview(story._id) }),
      ...(note && { notePreview: { ...note, username: noteAuthor.username } }),
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
    if (uploadedKeys.length && !persisted) await removeMedia(uploadedKeys);
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
        select: 'postedBy caption images media kind sharedContent music',
        populate: { path: 'postedBy', select: 'username profileImg' }
      })
      .populate({
        path: 'reactions',
        select: 'user type',
        populate: { path: 'user', select: 'username profileImg' }
      })
      .lean();

    const messages = sendCursor(res, pageRows, 50).reverse();
    if (!req.query.before && req.query.markRead !== "false") {
      await markInboxRead(userId, conversation._id, messages.at(-1), !isGroupConversation,
        otherUserId && !groupId ? [otherUserId] : []);
    }

    const hydrated = await messagePreviews(messages, req.user);
    const decryptedMessages = await Promise.all(hydrated.map((msg) => signMessagePayload({
      ...msg, text: readMessageText(msg), iv: undefined,
      replyTo: msg.replyTo ? { ...msg.replyTo, text: readMessageText(msg.replyTo), iv: undefined } : null,
      isGroupMessage: isGroupConversation, groupId: groupId || null,
    })));

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


const inboxConversationFields = "participants updatedAt lastMessage snowfall backgroundTheme customBackgroundKey chatFont themeRevision";

function presentInboxPreview(lastMessage) {
  let text = "";
  try {
    if (lastMessage?.iv) text = decrypt({ iv: lastMessage.iv, encryptedData: lastMessage.text });
  } catch {
    text = "[Decryption failed]";
  }
  return {
    text,
    sender: lastMessage?.sender || null,
    seen: lastMessage?.seen || false,
    mentionedUsers: lastMessage?.mentionedUsers === undefined ? [] : lastMessage.mentionedUsers,
  };
}

export const getConversation = async (req, res) => {
  try {
    const user = req.user._id;
    const userId = String(user);
    const [direct, groups] = await Promise.all([
      Conversation.find({ participants: user, kind: { $ne: "group" } }).select(inboxConversationFields).lean(),
      Group.find({ members: user, blocked: { $ne: user }, conversation: { $exists: true, $ne: null } })
        .select("name description profileImage owner admins members blocked conversation").lean(),
    ]);
    const [referencedIds, groupConversations] = await Promise.all([
      direct.length ? Group.distinct("conversation", { conversation: { $in: direct.map(({ _id }) => _id) } }) : [],
      groups.length ? Conversation.find({ _id: { $in: groups.map(({ conversation }) => conversation) } })
        .select(inboxConversationFields).lean() : [],
    ]);
    const referenced = new Set(referencedIds.map(String));
    const groupByConversation = new Map();
    for (const group of groups) {
      const key = String(group.conversation);
      if (!groupByConversation.has(key)) groupByConversation.set(key, group);
    }
    const threads = direct.filter(({ _id }) => !referenced.has(String(_id))).map((conversation) => ({
      conversation, members: (conversation.participants ?? []).filter((id) => String(id) !== userId),
    }));
    // Preserve group iteration order, including when timestamps tie.
    const groupThreads = new Map(groupConversations.map((conversation) => [String(conversation._id), conversation]));
    for (const [key, group] of groupByConversation) {
      const conversation = groupThreads.get(key);
      if (!conversation) continue;
      const blocked = new Set((group.blocked ?? []).map(String));
      threads.push({ conversation, group, members: (group.members ?? []).filter((id) => !blocked.has(String(id))) });
    }
    if (!threads.length) return res.json([]);

    const profileIds = new Map();
    for (const { members } of threads) {
      for (const id of members) profileIds.set(String(id), id);
    }
    const [people, preferences] = await Promise.all([
      profileIds.size ? User.find({ _id: { $in: [...profileIds.values()] } })
        .select("username profileImg lastActiveAt").lean() : [],
      ConversationPreference.find({ user, conversation: { $in: threads.map(({ conversation }) => conversation._id) } })
        .select("conversation pinned archived revision").lean(),
    ]);
    const profiles = new Map(await Promise.all(people.map(async (person) => [
      String(person._id), await presentProfile({ profileImg: "", ...person }),
    ])));
    const preferenceById = new Map(preferences.map((item) => [String(item.conversation), conversationPreference(item)]));

    const results = await Promise.all(threads.map(async ({ conversation, group, members }) => {
      const participants = [];
      for (const id of members) {
        const profile = profiles.get(String(id));
        if (!profile) continue;
        if (group) {
          const { lastActiveAt: _lastActiveAt, ...groupProfile } = profile;
          participants.push(groupProfile);
        } else participants.push(profile);
      }
      const [theme, groupImage] = await Promise.all([
        conversationTheme(conversation), group ? mediaUrl(group.profileImage) : undefined,
      ]);
      return {
        _id: conversation._id,
        ...theme,
        ...(group && { groupInfo: { _id: group._id, name: group.name, description: group.description,
          profileImage: groupImage, owner: group.owner, admins: group.admins === undefined ? [] : group.admins } }),
        participants,
        lastMessage: presentInboxPreview(conversation.lastMessage),
        updatedAt: conversation.updatedAt,
        isGroup: Boolean(group),
        groupId: group?._id ?? null,
        preference: preferenceById.get(String(conversation._id)),
      };
    }));
    return res.json(results.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt)));
  } catch (error) {
    console.error("Could not fetch conversations:", error.name);
    return res.status(500).json({ error: "Failed to fetch conversations" });
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



export async function getUnreadMessages(req, res, next) {
  try {
    return res.json(await inboxUnread(req.user._id));
  } catch (error) {
    return next(error);
  }
}

export async function markMessagesRead(req, res, next) {
  const { conversationId } = req.params;
  const { messageId } = req.body ?? {};
  if (!mongoose.isObjectIdOrHexString(conversationId) || !mongoose.isObjectIdOrHexString(messageId)) {
    return res.status(400).json({ error: "Choose a valid message." });
  }
  try {
    const user = req.user._id;
    const { members, group } = await messageAudience(conversationId);
    if (!members.includes(String(user))) return res.status(404).json({ error: "Conversation not found." });
    const message = await Message.findOne({ _id: messageId, conversationId, deletedFor: { $ne: user } }).select("createdAt").lean();
    if (!message) return res.status(404).json({ error: "Message not found." });
    await markInboxRead(user, conversationId, message, !group, group ? [] : members.filter((id) => id !== String(user)));
    return res.sendStatus(204);
  } catch (error) {
    return next(error);
  }
}

export async function messageAudience(conversationId) {
  const group = await Group.findOne({ conversation: conversationId }).select("members blocked permissions owner admins").lean();
  if (group) {
    const blocked = new Set((group.blocked ?? []).map(String));
    return { group, members: (group.members ?? []).map(String).filter((id) => !blocked.has(id)) };
  }
  const conversation = await Conversation.findOne({ _id: conversationId, kind: { $ne: "group" } }).select("participants").lean();
  return { members: (conversation?.participants ?? []).map(String) };
}

function conversationPreference({ pinned, archived, revision }) {
  return { pinned: Boolean(pinned), archived: Boolean(archived), revision };
}

export async function setConversationPreference(req, res, next) {
  const { conversationId } = req.params;
  const { pinned, archived } = req.body ?? {};
  const change = Object.fromEntries(Object.entries({ pinned, archived }).filter(([, value]) => value !== undefined));
  if (!mongoose.isObjectIdOrHexString(conversationId) || !Object.keys(change).length
    || Object.values(change).some((value) => typeof value !== "boolean")) {
    return res.status(400).json({ error: "Choose a valid conversation preference." });
  }
  try {
    const user = req.user._id;
    if (!(await belongsToConversation(conversationId, user))) return res.status(404).json({ error: "Conversation not found." });
    const filter = { user, conversation: conversationId };
    const update = { $set: change, $inc: { revision: 1 } };
    let item;
    try {
      item = await ConversationPreference.findOneAndUpdate(filter, update, { new: true, upsert: true });
    } catch (error) {
      if (error.code !== 11000) throw error;
      item = await ConversationPreference.findOneAndUpdate(filter, update, { new: true });
    }
    const payload = { conversationId, preference: conversationPreference(item) };
    getIO()?.to(getRecipientRoom(user)).emit("conversationPreferenceChanged", payload);
    return res.json(payload);
  } catch (error) {
    return next(error);
  }
}

function stopSharingLocation(now) {
  return {
    $set: { "location.stoppedAt": now },
    $unset: { "location.iv": "", "location.encryptedData": "" },
    $inc: { "location.revision": 1 },
  };
}

function emitLocation(message, members) {
  const payload = { messageId: message._id, conversationId: message.conversationId, location: presentLocation(message.location) };
  const deletedFor = new Set((message.deletedFor ?? []).map(String));
  const rooms = members.filter((id) => !deletedFor.has(id)).map(getRecipientRoom);
  if (rooms.length) getIO()?.to(rooms).emit("liveLocationUpdated", payload);
  return payload;
}

export async function updateLiveLocation(req, res, next) {
  const { messageId } = req.params;
  const stop = req.body?.stop === true;
  const coordinates = stop ? null : readCoordinates(req.body);
  if (!mongoose.isObjectIdOrHexString(messageId) || (!stop && !coordinates)) {
    return res.status(400).json({ error: "Choose a valid live location update." });
  }
  try {
    const sender = req.user._id;
    const now = new Date();
    const filter = { _id: messageId, sender, "location.mode": "live", deletedFor: { $ne: sender } };
    const original = await Message.findOne(filter).select("conversationId location deletedFor").lean();
    if (!original) return res.status(404).json({ error: "Live location not found." });
    const { members } = await messageAudience(original.conversationId);
    if (!stop && !members.includes(String(sender))) return res.status(404).json({ error: "Live location not found." });
    if (original.location.stoppedAt || original.location.expiresAt <= now) {
      if (stop) return res.json({ messageId, conversationId: original.conversationId, location: presentLocation(original.location) });
      return res.status(410).json({ error: "Live location sharing has ended." });
    }
    let change = stopSharingLocation(now);
    if (!stop) {
      const { iv, encryptedData } = sealCoordinates(coordinates);
      change = { $set: { "location.updatedAt": now, "location.iv": iv, "location.encryptedData": encryptedData },
        $inc: { "location.revision": 1 } };
    }
    const updated = await Message.findOneAndUpdate({
      ...filter, "location.stoppedAt": null, "location.expiresAt": { $gt: now },
    }, change, { new: true, timestamps: false })
      .select("conversationId location deletedFor").lean();
    if (!updated) return res.status(410).json({ error: "Live location sharing has ended." });
    return res.json(emitLocation(updated, members));
  } catch (error) {
    return next(error);
  }
}

export async function setConversationTheme(req, res, next) {
  const { conversationId } = req.params;
  const { snowfall, backgroundTheme, chatFont, removeCustomBackground } = req.body ?? {};
  if (!mongoose.isObjectIdOrHexString(conversationId)) return res.status(400).json({ error: "Choose a valid conversation." });
  const change = {};
  if (snowfall !== undefined) {
    if (typeof snowfall !== "boolean") return res.status(400).json({ error: "Choose whether snowfall is on or off." });
    change.snowfall = snowfall;
  }
  if (backgroundTheme !== undefined) {
    if (backgroundTheme !== "custom" && !chatBackgrounds.includes(backgroundTheme)) {
      return res.status(400).json({ error: "Choose an available chat background." });
    }
    change.backgroundTheme = backgroundTheme;
  }
  if (chatFont !== undefined) {
    if (!chatFonts.includes(chatFont)) return res.status(400).json({ error: "Choose a built-in chat font." });
    change.chatFont = chatFont;
  }
  if (req.file) {
    if (backgroundTheme !== "custom" || !["image/jpeg", "image/png", "image/webp"].includes(req.file.mimetype)) {
      return res.status(415).json({ error: "Choose a JPEG, PNG or WebP image for the custom background." });
    }
  }
  if (removeCustomBackground !== undefined) {
    if (removeCustomBackground !== true || !chatBackgrounds.includes(backgroundTheme) || req.file) {
      return res.status(400).json({ error: "Choose a preset background when removing the saved image." });
    }
    change.customBackgroundKey = null;
  }
  if (!Object.keys(change).length) return res.status(400).json({ error: "Choose a chat appearance setting." });
  let uploadedKey;
  let committed = false;
  try {
    let { members, group } = await messageAudience(conversationId);
    if (!members.includes(String(req.user._id))) return res.status(404).json({ error: "Conversation not found." });
    if (req.file) {
      ({ key: uploadedKey } = await saveMedia(req.file, { signal: req.requestAbortSignal, kind: "image", conversationId, chatBackground: true }));
      change.customBackgroundKey = uploadedKey;
      ({ members, group } = await messageAudience(conversationId));
      if (!members.includes(String(req.user._id))) return res.status(404).json({ error: "Conversation not found." });
    }
    const filter = { _id: conversationId, ...(group ? {} : { participants: req.user._id, kind: { $ne: "group" } }) };
    const needsSavedImage = backgroundTheme === "custom" && !uploadedKey;
    if (needsSavedImage) filter.customBackgroundKey = { $type: "string" };
    // The pre-update record identifies the displaced image even if another member writes concurrently.
    const previous = await Conversation.findOneAndUpdate(filter, {
      $set: change, $inc: { themeRevision: 1 },
    }, { new: false, timestamps: false }).select("snowfall backgroundTheme customBackgroundKey chatFont themeRevision").lean();
    if (!previous) return needsSavedImage
      ? res.status(400).json({ error: "Upload an image to use a custom background." })
      : res.status(404).json({ error: "Conversation not found." });
    committed = true;
    const theme = { conversationId: String(previous._id), ...(await conversationTheme({
      ...previous, ...change, themeRevision: (previous.themeRevision ?? 0) + 1,
    })) };
    getIO()?.to(members.map(getRecipientRoom)).emit("conversationThemeChanged", theme);
    if (Object.hasOwn(change, "customBackgroundKey") && previous.customBackgroundKey) {
      await removeMedia([previous.customBackgroundKey]);
    }
    return res.json(theme);
  } catch (error) {
    return next(error);
  } finally {
    if (uploadedKey && !committed) {
      const inUse = await Conversation.exists({ _id: conversationId, customBackgroundKey: uploadedKey }).catch(() => true);
      if (!inUse) await removeMedia([uploadedKey]);
    }
  }
}

export const editMessage = async (req, res, next) => {
  const { messageId, newText } = req.body;
  const userId = req.user._id;
  if (!mongoose.isObjectIdOrHexString(messageId) || typeof newText !== "string"
    || !newText.trim() || newText.length > 4000) return res.status(400).json({ error: "Enter a valid message." });
  try {
    const filter = { _id: messageId, sender: userId, type: { $nin: ["poll", "post", "location"] },
      call: { $exists: false }, deletedFor: { $ne: userId } };
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
    const mentions = await resolveMentions(text, group, userId);
    const change = { text: encrypted.encryptedData, iv: encrypted.iv, edited: true, mentions };
    const result = await Message.updateOne(filter, { $set: change });
    if (!result.matchedCount) return res.status(404).json({ error: "Message not found." });
    await Conversation.updateOne({
      _id: original.conversationId, "lastMessage.messageId": messageId,
    }, { $set: { "lastMessage.text": change.text, "lastMessage.iv": change.iv,
      "lastMessage.mentionedUsers": mentions.map(({ user }) => user) } }, { timestamps: false });
    const payload = { _id: messageId, conversationId: original.conversationId, text, edited: true, mentions };
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
        select: 'postedBy caption images media kind sharedContent music',
        populate: { path: 'postedBy', select: 'username profileImg' }
      })
      .populate({
        path: 'reactions',
        select: 'user type',
        populate: { path: 'user', select: 'username profileImg' }
      })
      .lean();

    const messages = sendCursor(res, pageRows, 50).reverse();
    if (!req.query.before && req.query.markRead !== "false") {
      await markInboxRead(userId, conversation._id, messages.at(-1), false);
    }

    const receipts = await groupReadReceipts(messages, conversation._id, userId, group);
    const hydrated = await messagePreviews(receipts, req.user);
    const decryptedMessages = await Promise.all(hydrated.map((msg) => signMessagePayload({
      ...msg, text: readMessageText(msg), iv: undefined,
      replyTo: msg.replyTo ? { ...msg.replyTo, text: readMessageText(msg.replyTo), iv: undefined } : null,
      isGroupMessage: true, groupId,
    })));

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
    const message = await Message.findById(messageId).select("conversationId sender location.mode").lean();
    const { members } = message ? await messageAudience(message.conversationId) : { members: [] };
    if (!members.includes(String(userId))) {
      return res.status(404).json({ error: "Message not found." });
    }
    if (message.location?.mode === "live" && String(message.sender) === String(userId)) {
      const stopped = await Message.findOneAndUpdate({
        _id: messageId, "location.stoppedAt": null,
      }, stopSharingLocation(new Date()), { new: true, timestamps: false })
        .select("conversationId location deletedFor").lean();
      if (stopped) emitLocation(stopped, members);
    }
    await Message.updateOne({ _id: messageId }, { $addToSet: { deletedFor: userId } });
    getIO()?.to(getRecipientRoom(userId)).emit("messageDeleted", { messageId });
    return res.json({ success: true });
  } catch (error) {
    return next(error);
  }
};
