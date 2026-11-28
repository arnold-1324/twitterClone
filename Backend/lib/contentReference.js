import mongoose from "mongoose";
import Post from "../models/post.model.js";
import { Story } from "../models/story.model.js";
import User from "../models/user.model.js";
import { mediaUrl, streamUrl } from "./mediaStore.js";

export function readContentReference(value) {
  if (!value) return null;
  const [type, id, extra] = typeof value === "string" ? value.split(":") : [];
  if (!["story", "post"].includes(type) || !mongoose.isObjectIdOrHexString(id) || extra !== undefined) {
    throw Object.assign(new Error("Choose a valid story, post, or reel."), { status: 400 });
  }
  return { type, id };
}

export async function resolveContentReference({ type, id }) {
  const item = type === "story"
    ? await Story.findOne({ _id: id, expiresAt: { $gt: new Date() } }).lean()
    : await Post.findById(id).select("postedBy caption kind media images sharedContent music").lean();
  if (!item) return null;
  const author = await User.findOne({ _id: item.author || item.postedBy, isFrozen: { $ne: true } })
    .select("username profileImg").lean();
  if (!author) return null;
  const source = item.sharedContent ? await resolveOriginal(item.sharedContent) : null;
  if (item.sharedContent && !source) return null;
  const assets = type === "story" ? (item.mediaKey ? [{ type: item.kind, key: item.mediaKey }] : [])
    : item.media?.length ? item.media : item.images ? [{ type: "image", key: item.images }] : [];
  const media = source?.media ?? await Promise.all(assets.map(async ({ type, key, credit }) => ({
    type, url: await mediaUrl(key), ...(type === "video" && { streamUrl: streamUrl(key) }),
    ...(credit?.source && { credit }),
  })));
  const expiresAt = item.expiresAt ?? source?.expiresAt;
  return {
    type, id: item._id, kind: type === "story" ? "story" : item.kind ?? "post",
    username: author.username, profileImg: await mediaUrl(author.profileImg), caption: item.caption || "", media, expiresAt,
    composition: item.composition, music: item.music,
    original: source?.original ?? { type, id: item._id },
  };
}

// New reposts store the original reference, so reading them never walks a chain.
async function resolveOriginal(reference) {
  const model = reference.type === "story" ? Story : Post;
  if (!await model.exists({ _id: reference.id, sharedContent: { $exists: false } })) return null;
  return resolveContentReference(reference);
}
