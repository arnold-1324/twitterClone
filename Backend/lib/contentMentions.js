import mongoose from "mongoose";
import User from "../models/user.model.js";
import Message from "../models/message.model.js";
import { getOrCreateDirect } from "./directConversation.js";
import { encrypt } from "./utils/Msg_encryption/encrypt.js";
import { presentProfile } from "./utils/presentProfile.js";
import { presentPost } from "./utils/presentPost.js";
import { saveConversationPreview } from "./conversationPreview.js";
import { getIO, getRecipientRoom } from "../socket/socket.js";
import { resolveContentReference } from "./contentReference.js";
import { storyMessagePreview } from "./messagePreviews.js";

export async function contentMentions(author, caption, tags) {
  const tagIds = typeof tags === "string" ? tags.split(",").filter(Boolean) : [];
  if (tagIds.length > 10 || tagIds.some((id) => !mongoose.isObjectIdOrHexString(id))) {
    throw Object.assign(new Error("Tag up to 10 people."), { status: 400 });
  }
  const names = [...caption.matchAll(/(?<![\w.@])@([\w-][\w.@-]{0,63})/g)]
    .map(([, value]) => value.replace(/\.+$/, "")).slice(0, 10);
  if (!tagIds.length && !names.length) return [];
  return User.find({ _id: { $ne: author }, isFrozen: { $ne: true },
    $or: [{ _id: { $in: tagIds } }, { username: { $in: names } }],
  }).select("_id").limit(10).lean();
}

export async function deliverContentMentions(sender, recipients, item, kind) {
  if (!recipients.length) return;
  const text = `Tagged you in a ${kind}`;
  const encrypted = encrypt(text);
  const fields = { text: encrypted.encryptedData, iv: encrypted.iv };
  const [author, post] = await Promise.all([
    presentProfile({ _id: sender._id, username: sender.username, profileImg: sender.profileImg }),
    kind === "story" ? null : presentPost(item),
  ]);
  const content = kind === "story" && item.sharedContent && await resolveContentReference(item.sharedContent);
  const reference = kind === "story"
    ? { storyReference: { id: item._id, username: sender.username, purpose: "mention",
      video: item.kind === "video" || content?.media[0]?.type === "video" } }
    : { type: "post", postReference: item._id };
  const storyPreview = kind === "story" ? await storyMessagePreview(item._id) : null;
  const results = await Promise.allSettled(recipients.map(async ({ _id }) => {
    const conversation = await getOrCreateDirect(sender._id, String(_id));
    const message = await Message.create({ ...reference, ...fields, conversationId: conversation._id, sender: sender._id });
    await saveConversationPreview(message, fields).catch((error) => console.error("Tag message preview:", error.message));
    getIO()?.to(getRecipientRoom(_id)).emit("newMessage", {
      ...message.toObject(), text, iv: undefined, sender: author,
      ...(kind === "story" && { storyPreview }),
      ...(post && { postReference: { ...post, postedBy: author, images: post.imageUrl } }),
    });
  }));
  const failures = results.filter(({ status }) => status === "rejected");
  if (failures.length) console.error("Could not deliver content mentions:", failures.length);
}
