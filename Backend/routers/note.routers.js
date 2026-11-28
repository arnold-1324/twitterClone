import express from "express";
import Note, { noteThemes } from "../models/note.model.js";
import User from "../models/user.model.js";
import { protectRoute } from "../middleware/protectRoute.js";
import { limitResource } from "../lib/rateLimits.js";
import { day } from "../lib/storyLifetime.js";
import { presentProfile } from "../lib/utils/presentProfile.js";
import { canSeeNote } from "../lib/noteAudience.js";
import mongoose from "mongoose";
import { getTrack } from "../lib/musicCatalog.js";
import { readClip } from "../lib/photoComposition.js";
import { recordMusicClip } from "../lib/hostedMusic.js";

const router = express.Router();
router.use(protectRoute);

router.get("/profile/:id", limitResource, async (req, res, next) => {
  const { id } = req.params;
  if (!mongoose.isObjectIdOrHexString(id) || !canSeeNote(req.user, id.toLowerCase())) return res.json(null);
  try {
    const [note, author] = await Promise.all([
      Note.findOne({ _id: id, expiresAt: { $gt: new Date() } }).lean(),
      User.findOne({ _id: id, isFrozen: { $ne: true } }).select("username fullName profileImg").lean(),
    ]);
    return res.json(note && author ? { ...note, author: await presentProfile(author) } : null);
  } catch (error) {
    return next(error);
  }
});

router.get("/", limitResource, async (req, res, next) => {
  try {
    const followed = new Set(req.user.following.map(String));
    const audience = [req.user._id, ...req.user.followers.filter((id) => followed.has(String(id)))];
    const filter = { expiresAt: { $gt: new Date() } };
    const [own, others] = await Promise.all([
      Note.findOne({ _id: req.user._id, ...filter }).lean(),
      Note.find({ _id: { $in: audience.slice(1) }, ...filter }).sort({ updatedAt: -1 }).limit(35).lean(),
    ]);
    const rows = own ? [own, ...others] : others;
    const users = await User.find({ _id: { $in: rows.map(({ _id }) => _id) }, isFrozen: { $ne: true } })
      .select("username fullName profileImg").lean();
    const authors = new Map(await Promise.all(users.map(async (item) => [String(item._id), await presentProfile(item)])));
    return res.json(rows.flatMap((note) => {
      const author = authors.get(String(note._id));
      return author ? [{ ...note, author }] : [];
    }));
  } catch (error) {
    return next(error);
  }
});

router.put("/", limitResource, async (req, res, next) => {
  const { text, theme, musicId, musicStart, musicDuration } = req.body ?? {};
  const quote = typeof text === "string" ? text.trim() : "";
  if (req.user.isFrozen) return res.status(403).json({ error: "This account cannot publish notes." });
  try {
    const track = musicId ? await getTrack(musicId) : null;
    if (musicId && !track) return res.status(400).json({ error: "Choose a track from the music library." });
    if ((!quote && !track) || quote.length > 120 || !noteThemes.includes(theme)) {
      return res.status(400).json({ error: "Add a quote of up to 120 characters or choose a track, and select a theme." });
    }
    const clip = track && track.provider !== "spotify"
      ? readClip(track, musicStart === undefined ? 0 : musicStart,
        musicDuration === undefined ? Math.min(20, track.duration) : musicDuration)
      : null;
    const note = await Note.findOneAndUpdate({ _id: req.user._id }, {
      $set: {
        text: quote, theme,
        musicId: track?.id ?? null, musicStart: clip?.start ?? null, musicDuration: clip?.duration ?? null, trackId: null, albumId: null,
        expiresAt: new Date(Date.now() + day),
      },
    }, { new: true, upsert: true });
    if (clip) recordMusicClip(req.user._id, { id: track.id, ...clip }, "note");
    return res.json(note);
  } catch (error) {
    return next(error);
  }
});

router.delete("/", limitResource, async (req, res, next) => {
  try {
    await Note.deleteOne({ _id: req.user._id });
    return res.sendStatus(204);
  } catch (error) {
    return next(error);
  }
});

export default router;
