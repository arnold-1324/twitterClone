import { recordMusicClip } from "../lib/hostedMusic.js";
import express from "express";
import mongoose from "mongoose";
import { Story, StoryLike } from "../models/story.model.js";
import User from "../models/user.model.js";
import { protectRoute } from "../middleware/protectRoute.js";
import { limitResource, limitUpload } from "../lib/rateLimits.js";
import { isImage, isVideo, upload } from "../lib/utils/uploader.js";
import { mediaUrl, removeMedia, saveMedia, streamUrl } from "../lib/mediaStore.js";
import { activeStory, day, findVisibleStory } from "../lib/storyLifetime.js";
import { presentProfile } from "../lib/utils/presentProfile.js";
import StoryActivity from "../models/storyActivity.model.js";
import { recordStoryActivity, viewedStoryLookup } from "../lib/storyActivity.js";
import { readContentReference, resolveContentReference } from "../lib/contentReference.js";
import { contentMentions, deliverContentMentions } from "../lib/contentMentions.js";
import { readMusic, readStoryComposition } from "../lib/photoComposition.js";

const router = express.Router();
const missing = (res) => res.status(404).json({ error: "This story is unavailable." });
router.use(protectRoute);

router.get("/feed", limitResource, async (req, res, next) => {
  try {
    const owner = req.user._id;
    const summaries = await Story.aggregate([
      { $match: { author: { $in: [owner, ...(req.user.following ?? [])] }, ...activeStory() } },
      viewedStoryLookup(owner),
      { $set: { seen: { $or: [{ $eq: ["$author", owner] }, { $gt: [{ $size: "$views" }, 0] }] } } },
      { $group: {
        _id: "$author", count: { $sum: 1 }, last: { $max: "$_id" }, expiresAt: { $max: "$expiresAt" },
        unseen: { $max: { $not: ["$seen"] } },
        unseenCount: { $sum: { $cond: ["$seen", 0, 1] } },
        first: { $top: { sortBy: { seen: 1, _id: 1 }, output: { _id: "$_id", kind: "$kind", mediaKey: "$mediaKey", expiresAt: "$expiresAt" } } },
      } },
      { $sort: { unseen: -1, last: -1 } },
      { $limit: 71 },
    ]).option({ maxTimeMS: 3000 });
    const authors = await User.find({ _id: { $in: summaries.map(({ _id }) => _id) }, isFrozen: { $ne: true } })
      .select("username fullName profileImg").lean();
    const profiles = new Map(await Promise.all(authors.map(async (row) => [String(row._id), await presentProfile(row)])));
    const ordered = summaries.flatMap(({ _id, first, ...summary }) => {
      const author = profiles.get(String(_id));
      return author ? [{ ...summary, author, first }] : [];
    });
    // The user's own ring remains available even when their follows fill the shelf.
    if (!ordered.some(({ author }) => author._id.equals(owner))) {
      const own = await Story.findOne({ author: owner, ...activeStory() }).sort({ _id: -1 }).select("expiresAt").lean();
      if (own && !req.user.isFrozen) {
        const { username, fullName, profileImg } = req.user;
        ordered.unshift({ last: own._id, expiresAt: own.expiresAt, author: await presentProfile({ _id: owner, username, fullName, profileImg }) });
      }
    }
    return res.json(await Promise.all(ordered.map(async ({ first, ...summary }, index) => ({
      ...summary,
      ...(index < 6 && first?.mediaKey && { preview: {
        _id: first._id,
        kind: first.kind, expiresAt: first.expiresAt, url: await mediaUrl(first.mediaKey),
        streamUrl: first.kind === "video" ? streamUrl(first.mediaKey) : undefined,
      } }),
    }))));
  } catch (error) {
    return next(error);
  }
});

router.post("/", limitResource, limitUpload, upload.single("media"), async (req, res, next) => {
  const caption = typeof req.body?.caption === "string" ? req.body.caption.trim() : "";
  const kind = req.file && (isImage(req.file) ? "image" : isVideo(req.file) ? "video" : null);
  if ((req.file && !kind) || caption.length > 220) {
    return res.status(400).json({ error: "Choose a photo or video and a caption of up to 220 characters." });
  }
  if (req.user.isFrozen) return res.status(403).json({ error: "This account cannot publish stories." });
  const id = new mongoose.Types.ObjectId();
  let mediaKey;
  let saved;
  try {
    const composition = readStoryComposition(req.body?.composition);
    const music = await readMusic(req.body?.music);
    const reference = readContentReference(req.body?.source);
    const source = reference && await resolveContentReference(reference);
    if (reference && !source) return missing(res);
    if (!kind && !source && !composition?.layers.length && !music) {
      return res.status(400).json({ error: "Add a photo, video, text, sticker, or music." });
    }
    if (source && req.file) return res.status(400).json({ error: "Choose a photo, video, or reshare." });
    const recipients = await contentMentions(req.user._id, caption, req.body?.tags);
    if (kind) ({ key: mediaKey } = await saveMedia(req.file, { signal: req.requestAbortSignal, kind, storyId: id }));
    const expiresAt = new Date(Math.min(Date.now() + day, source?.expiresAt?.getTime() ?? Infinity));
    saved = await Story.create({ _id: id, author: req.user._id, mediaKey, kind: kind || (source ? "shared" : "canvas"),
      sharedContent: source?.original, caption, expiresAt, composition, music });
    recordMusicClip(req.user._id, music, "story");
    if (reference?.type === "story") {
      const story = await findVisibleStory(reference.id);
      if (story) await recordStoryActivity(story, req.user._id, "shared").catch((error) => console.error("Story reshare activity:", error.message));
    }
    await deliverContentMentions(req.user, recipients, saved, "story").catch((error) => console.error("Story mentions:", error.message));
    return res.status(201).json({ _id: id, expiresAt });
  } catch (error) {
    if (!saved && mediaKey && !await Story.exists({ _id: id }).catch(() => true)) await removeMedia([mediaKey]);
    return next(error);
  }
});

router.get("/profile/:username/status", limitResource, async (req, res, next) => {
  try {
    const user = await User.findOne({ username: req.params.username, isFrozen: { $ne: true } }).select("_id").lean();
    if (!user) return res.json(null);
    const [status] = await Story.aggregate([
      { $match: { author: user._id, ...activeStory() } },
      viewedStoryLookup(req.user._id),
      { $group: { _id: "$author", expiresAt: { $max: "$expiresAt" },
        unseen: { $max: { $eq: [{ $size: "$views" }, 0] } } } },
    ]).option({ maxTimeMS: 3000 });
    return res.json(status ?? null);
  } catch (error) {
    return next(error);
  }
});

router.get("/profile/:username", limitResource, async (req, res, next) => {
  const { after, start } = req.query;
  if ([after, start].some((id) => id !== undefined && !mongoose.isObjectIdOrHexString(id))) {
    return res.status(400).json({ error: "Invalid story link." });
  }
  try {
    const user = await User.findOne({ username: req.params.username, isFrozen: { $ne: true } }).select("username fullName profileImg").lean();
    if (!user) return missing(res);
    const filter = { author: user._id, ...activeStory() };
    if (after) filter._id = { $gt: after };
    else if (start) {
      if (!await Story.exists({ ...filter, _id: start })) return missing(res);
      filter._id = { $gte: start };
    }
    const rows = await Story.find(filter).sort({ _id: 1 }).limit(25).lean();
    const more = rows.length === 25;
    if (more) rows.pop();
    const ids = rows.map(({ _id }) => _id);
    const [likeIds, receipts] = await Promise.all([
      StoryLike.distinct("story", { story: { $in: ids }, user: req.user._id }),
      StoryActivity.find({ story: { $in: ids }, viewer: req.user._id }).select("story viewedAt reaction").lean(),
    ]);
    const likes = new Set(likeIds.map(String));
    const activity = new Map(receipts.map((row) => [String(row.story), row]));
    const stories = await Promise.all(rows.map(async ({ _id, kind, caption, mediaKey, sharedContent, createdAt, expiresAt, composition, music }) => {
      const original = sharedContent && await resolveContentReference(sharedContent);
      return {
        _id, kind, caption, createdAt, expiresAt, composition, music, url: await mediaUrl(mediaKey),
        streamUrl: kind === "video" ? streamUrl(mediaKey) : undefined,
        liked: likes.has(String(_id)), seen: Boolean(activity.get(String(_id))?.viewedAt),
        reaction: activity.get(String(_id))?.reaction,
        ...(sharedContent && { sharedContent: original ?? { unavailable: true } }),
      };
    }));
    return res.json({ author: await presentProfile(user), stories, cursor: more ? rows.at(-1)._id : null });
  } catch (error) {
    return next(error);
  }
});

router.put("/:id/view", limitResource, async (req, res, next) => {
  if (!mongoose.isObjectIdOrHexString(req.params.id)) return missing(res);
  try {
    const story = await findVisibleStory(req.params.id);
    if (!story) return missing(res);
    await recordStoryActivity(story, req.user._id, "view");
    return res.sendStatus(204);
  } catch (error) {
    return next(error);
  }
});

router.put("/:id/reaction", limitResource, async (req, res, next) => {
  const { reaction } = req.body ?? {};
  if (!mongoose.isObjectIdOrHexString(req.params.id) || ![null, "🔥", "😍", "😂", "😮", "👏"].includes(reaction)) {
    return res.status(400).json({ error: "Choose a story reaction." });
  }
  try {
    const story = await findVisibleStory(req.params.id);
    if (!story) return missing(res);
    if (story.author.equals(req.user._id)) return res.status(400).json({ error: "Choose someone else's story to react." });
    await recordStoryActivity(story, req.user._id, "reaction", reaction);
    return res.json({ reaction });
  } catch (error) {
    return next(error);
  }
});

router.post("/:id/link-share", limitResource, async (req, res, next) => {
  if (!mongoose.isObjectIdOrHexString(req.params.id)) return missing(res);
  try {
    const story = await findVisibleStory(req.params.id);
    if (!story) return missing(res);
    await recordStoryActivity(story, req.user._id, "shared");
    return res.sendStatus(204);
  } catch (error) {
    return next(error);
  }
});

router.get("/:id/activity", limitResource, async (req, res, next) => {
  const offset = req.query.offset ?? "0";
  if (!mongoose.isObjectIdOrHexString(req.params.id)) return missing(res);
  if (typeof offset !== "string" || !/^\d{1,5}$/.test(offset)) return res.status(400).json({ error: "Invalid activity page." });
  try {
    const story = await Story.findOne({ _id: req.params.id, author: req.user._id, ...activeStory() }).select("_id").lean();
    if (!story) return missing(res);
    const [rows, totals, likes] = await Promise.all([
      StoryActivity.find({ story: story._id, viewer: { $ne: req.user._id } }).sort({ viewedAt: -1, _id: -1 })
        .skip(Number(offset)).limit(41).populate("viewer", "username profileImg fullName isFrozen").lean(),
      StoryActivity.aggregate([{ $match: { story: story._id } }, { $group: {
        _id: null, views: { $sum: { $cond: [{ $ifNull: ["$viewedAt", false] }, 1, 0] } },
        replies: { $sum: "$replied" }, shares: { $sum: "$shared" },
        reactions: { $sum: { $cond: [{ $ifNull: ["$reaction", false] }, 1, 0] } },
      } }]),
      StoryLike.countDocuments({ story: story._id }),
    ]);
    const page = rows.slice(0, 40);
    const hearts = new Set((await StoryLike.distinct("user", {
      story: story._id, user: { $in: page.flatMap(({ viewer }) => viewer?._id ? [viewer._id] : []) },
    })).map(String));
    const viewers = await Promise.all(page.filter(({ viewer }) => viewer && !viewer.isFrozen)
      .map(async ({ viewer, viewedAt, replied, shared, reaction }) => ({
        viewer: await presentProfile({ _id: viewer._id, username: viewer.username, fullName: viewer.fullName, profileImg: viewer.profileImg }),
        viewedAt, replied, shared, reaction, liked: hearts.has(String(viewer._id)),
      })));
    const { views = 0, replies = 0, shares = 0, reactions = 0 } = totals[0] ?? {};
    return res.json({ viewers, views, replies, shares, reactions, likes, next: rows.length > 40 ? Number(offset) + 40 : null });
  } catch (error) {
    return next(error);
  }
});

router.put("/:id/like", limitResource, async (req, res, next) => {
  if (!mongoose.isObjectIdOrHexString(req.params.id) || typeof req.body?.liked !== "boolean") {
    return res.status(400).json({ error: "Choose whether to like the story." });
  }
  try {
    const story = await findVisibleStory(req.params.id);
    if (!story) return missing(res);
    if (story.author.equals(req.user._id)) return res.status(400).json({ error: "Choose someone else's story to like." });
    const filter = { story: story._id, user: req.user._id };
    if (req.body.liked) {
      await StoryLike.updateOne(filter, { $setOnInsert: { expiresAt: story.expiresAt } }, { upsert: true })
        .catch((error) => { if (error.code !== 11000) throw error; });
    } else await StoryLike.deleteOne(filter);
    return res.json({ liked: req.body.liked });
  } catch (error) {
    return next(error);
  }
});

router.delete("/:id", limitResource, async (req, res, next) => {
  if (!mongoose.isObjectIdOrHexString(req.params.id)) return missing(res);
  try {
    const story = await Story.findOneAndUpdate({ _id: req.params.id, author: req.user._id, ...activeStory() },
      { $set: { expiresAt: new Date() } }).select("mediaKey").lean();
    if (!story) return missing(res);
    if (await removeMedia([story.mediaKey])) await Story.deleteOne({ _id: story._id });
    return res.sendStatus(204);
  } catch (error) {
    return next(error);
  }
});

export default router;
