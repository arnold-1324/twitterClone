import { recordAccountChanges } from "./accountHistory.controller.js";
import { recentInterests } from "../lib/recommendations.js";
import { clearSessionCookies } from "../lib/utils/generateToken.js";
import { getIO, getRecipientRoom } from "../socket/socket.js";
import { presentProfile } from "../lib/utils/presentProfile.js";
import { peopleCache, postCache } from "../lib/readCache.js";
import User from "../models/user.model.js";
import Post from "../models/post.model.js";
import Notification from "../models/notification.model.js";
import bcrypt from "bcryptjs";
import { saveMedia, removeMedia } from "../lib/mediaStore.js";
import mongoose from "mongoose";
import { redisClient } from "../Redis.js";

export const followUnfollowUser = async (req, res, next) => {
  const { id } = req.params;
  const actor = req.user._id;
  if (!mongoose.isObjectIdOrHexString(id) || String(actor) === id.toLowerCase()) {
    return res.status(400).json({ error: "Choose another account to follow." });
  }
  try {
    if (!(await User.exists({ _id: id }))) return res.status(404).json({ error: "User not found." });
    const following = typeof req.body?.following === "boolean" ? req.body.following : !(req.user.following ?? []).includes(id);
    const operator = following ? "$addToSet" : "$pull";
    const result = await User.updateOne({ _id: actor }, { [operator]: { following: id } });
    await User.updateOne({ _id: id }, { [operator]: { followers: actor } });
    if (following && result.modifiedCount) {
      await Notification.create({ type: "follow", from: actor, to: id })
        .then(() => getIO()?.to(getRecipientRoom(id)).emit("activityChanged"))
        .catch((error) => console.error("Could not create follow notification:", error.message));
    }
    return res.json({ following });
  } catch (error) {
    return next(error);
  }
};

export const getUserProfile = async (req, res) => {
  try {
    const { query } = req.params;   
    const cacheKey = `user:profile:${query}`;

    // Redis disabled: skip fetching cached user profile
    // const cachedUser = await redisClient.get(cacheKey);
    // if (cachedUser) {
    //   return res.status(200).json(JSON.parse(cachedUser));
    // }


    let user;
    if (mongoose.Types.ObjectId.isValid(query)) {
      user = await User.findById(query).select(
        "-password -updatedAt -verificationToken -verificationTokenExpiresAt -email -sessionVersion"
      );
    } else {
      user = await User.findOne({ username: query }).select(
        "-password -updatedAt -verificationToken -verificationTokenExpiresAt -email -sessionVersion"
      );
    }

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

 
    // Redis disabled: skip storing cached user profile
    // await redisClient.setEx(cacheKey, 600, JSON.stringify(user));

    const profile = await presentProfile(user);
    if (profile.hideBio && String(profile._id) !== String(req.user?._id)) delete profile.bio;
    return res.status(200).json(profile);

  } catch (error) {
    console.error("Error in getUserProfile:", error.message);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

export const getSuggestedUser = async (req, res, next) => {
  const userId = String(req.user._id);
  const following = new Set((req.user.following ?? []).map(String));
  try {
    const neighboring = await User.find({ _id: { $in: [...following].slice(0, 50) } })
      .select({ following: { $slice: 50 } }).maxTimeMS(2000).lean();
    const candidates = new Set();
    for (const neighbor of neighboring) {
      for (const neighborId of neighbor.following ?? []) {
        const id = String(neighborId);
        if (id !== userId && !following.has(id)) candidates.add(id);
      }
    }
    const { weights } = await recentInterests(req.user);
    const topics = [...weights].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([topic]) => topic);
    if (topics.length) {
      const matching = await Post.find({ topics: { $in: topics }, postedBy: { $nin: [userId, ...following] } })
        .sort({ createdAt: -1 }).limit(45).select("postedBy topics").lean().maxTimeMS(2000);
      const ranks = new Map();
      for (const post of matching) {
        const id = String(post.postedBy);
        const strength = post.topics.reduce((value, topic) => value + (weights.get(topic) ?? 0), 0);
        ranks.set(id, Math.max(ranks.get(id) ?? 0, strength));
      }
      for (const [id] of [...ranks].sort((a, b) => b[1] - a[1])) candidates.add(id);
    }
    const publicFields = "username fullName profileImg isVerified";
    const filter = candidates.size ? { $in: [...candidates].slice(0, 12) } : { $nin: [userId, ...following] };
    const people = await User.find({ _id: filter }).select(publicFields).limit(7).maxTimeMS(2000).lean();
    const order = [...candidates];
    if (order.length) people.sort((a, b) => order.indexOf(String(a._id)) - order.indexOf(String(b._id)));
    return res.json(await Promise.all(people.map(presentProfile)));
  } catch (error) {
    return next(error);
  }
};

export const UpdateUserProfile = async (req, res) => {
  let uploadedKey;
  let persisted = false;
  try {
    const { fullName, username, email, currentPassword, newPassword, bio } = req.body;
    const userId = req.user._id;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (req.params.id && req.params.id !== userId.toString()) {
      return res.status(400).json({ error: "You cannot update another user's profile" });
    }

    if ([fullName, username, email, currentPassword, newPassword, bio].some((value) =>
      value !== undefined && typeof value !== "string") || fullName?.length > 80 || bio?.length > 500
      || (username && username !== user.username && (!/^[a-zA-Z0-9_]{3,24}$/.test(username)
        || ["auth", "chat", "settings", "notifications", "update", "api", "search", "create", "reels", "discover", "saved", "activity"].includes(username.toLowerCase())))) {
      return res.status(400).json({ error: "Profile fields are invalid." });
    }
    if (email && email.trim().toLowerCase() !== user.email.toLowerCase()) {
      return res.status(400).json({ error: "Email changes require verification and are unavailable here." });
    }
    if ((newPassword && !currentPassword) || (!newPassword && currentPassword)) {
      return res.status(400).json({ error: "Please provide both current password and new password" });
    }

    if (currentPassword && newPassword) {
      if (Buffer.byteLength(currentPassword) > 72 || Buffer.byteLength(newPassword) > 72 || newPassword.length < 6) {
        return res.status(400).json({ error: "Enter a valid new password of at least six characters." });
      }
      const isMatch = await bcrypt.compare(currentPassword, user.password);
      if (!isMatch) {
        return res.status(400).json({ error: "Current password is incorrect" });
      }
      const passwordUpdate = await User.updateOne({ _id: userId, password: user.password }, {
        $set: { password: await bcrypt.hash(newPassword, 10) },
        $inc: { sessionVersion: 1 },
        $unset: { resetPasswordToken: "", resetPasswordExpires: "" },
      });
      if (!passwordUpdate.matchedCount) return res.status(409).json({ error: "The password was already changed." });
      await recordAccountChanges(userId, [{ kind: "password" }]);
      getIO()?.in(getRecipientRoom(userId)).disconnectSockets(true);
      clearSessionCookies(res);
      return res.json({ reauthenticate: true });
    }

    const changes = [];
    if (fullName && fullName !== user.fullName) changes.push({ kind: "name", profileValue: fullName });
    if (username && username !== user.username) changes.push({ kind: "username", profileValue: username });
    if (bio !== undefined && bio !== user.bio) changes.push({ kind: "bio", action: bio ? "changed" : "removed", profileValue: bio });

    if (req.file) {
      ({ key: uploadedKey } = await saveMedia(req.file, { signal: req.requestAbortSignal, kind: "image" }));
      user.profileImg = uploadedKey;
      changes.push({ kind: "photo" });
    }

    user.fullName = fullName || user.fullName;
    user.username = username || user.username;
    user.bio = bio ?? user.bio;

    const updatedUser = await user.save();
    persisted = true;
    await recordAccountChanges(userId, changes);
    peopleCache.clear();
    postCache.clear();

    await Post.updateMany(
			{ "replies.userId": userId },
			{
				$set: {
					"replies.$[reply].username": user.username,
					"replies.$[reply].profileImg": user.profileImg,
				},
			},
			{ arrayFilters: [{ "reply.userId": userId }] }
		);

    const account = updatedUser.toObject();
    for (const field of ["password", "sessionVersion", "verificationToken", "verificationTokenExpiresAt", "resetPasswordToken", "resetPasswordExpires"]) {
      delete account[field];
    }
    return res.json(await presentProfile(account));
  } catch (error) {
    if (uploadedKey && !persisted) await removeMedia([uploadedKey]);
    if (error.status) return res.status(error.status).json({ error: error.message });
    console.error("Error in UpdateUserProfile:", error.message);
    if (error.code === 11000) return res.status(409).json({ error: "That username is already in use." });
    return res.status(500).json({ error: "Could not update profile." });
  }
};

export async function searchUsers(req, res, next) {
  const query = typeof req.query.q === "string" ? req.query.q.trim().toLowerCase() : "";
  if (!/^[a-zA-Z0-9_]{2,24}$/.test(query)) return res.json([]);
  try {
    const matches = await peopleCache.read(query, () => User.find({
      username: { $regex: `^${query}`, $options: "i" },
    }).select("username fullName profileImg").sort({ username: 1 }).limit(13).maxTimeMS(1500).lean().exec());
    const visible = matches.filter((user) => String(user._id) !== String(req.user._id)).slice(0, 12);
    return res.json(await Promise.all(visible.map(presentProfile)));
  } catch (error) {
    return next(error);
  }
}
