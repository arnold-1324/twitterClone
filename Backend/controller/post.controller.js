import { isImage, isVideo } from "../lib/utils/uploader.js";
import { extractTopics, recentInterests, scorePost } from "../lib/recommendations.js";
import { presentProfile } from "../lib/utils/presentProfile.js";
import { messageAudience, saveConversationPreview } from "./messageController.js";
import { getIO, getRecipientRoom } from "../socket/socket.js";
import { postCache } from "../lib/readCache.js";
import { beforeCursor, sendCursor } from "../lib/cursorPage.js";
import { presentPost } from "../lib/utils/presentPost.js";
import { mediaUrl, removeMedia, saveMedia } from "../lib/mediaStore.js";
import Post from "../models/post.model.js";
import User from "../models/user.model.js";
import Notification from "../models/notification.model.js";

import mongoose from "mongoose";
import Message from "../models/message.model.js";
import Conversation from "../models/conversation.model.js";

import { encrypt } from "../lib/utils/Msg_encryption/encrypt.js";
import { redisClient } from "../Redis.js";


const presentPosts = async (posts) => {
    return await Promise.all(
        posts.map(post => presentPost(post))
    );
};


// ============================================================
// CREATE NEW POST
// ============================================================

async function publishPost(req, res, next, kind) {
    const reel = kind === "reel";
    const caption = typeof req.body.caption === "string" ? req.body.caption.trim() : "";
    const files = reel ? (req.file ? [req.file] : []) : [...(req.files?.image ?? []), ...(req.files?.media ?? [])];
    if (caption.length > 280 || (!files.length && (reel || !caption))) {
        return res.status(400).json({ error: reel ? "Choose a video and use up to 280 caption characters." : "Add a caption or photos." });
    }
    if (!files.every(reel ? isVideo : isImage)) {
        return res.status(415).json({ error: reel ? "Choose an MP4 or WebM video." : "Choose JPEG, PNG, GIF or WebP photos." });
    }
    const media = [];
    let saved;
    try {
        for (const file of files) {
            const { key, kind: type } = await saveMedia(file, { kind: reel ? "video" : "image" });
            media.push({ key, type });
        }
        saved = await Post.create({
            postedBy: req.user._id, caption, kind, topics: extractTopics(caption), media,
            images: reel ? "" : media[0]?.key ?? "",
        });
        return res.status(201).json(await presentPost(saved));
    } catch (error) {
        if (!saved) await removeMedia(media.map(({ key }) => key));
        return next(error);
    }
}

export const NewPost = (req, res, next) => publishPost(req, res, next, "post");
export const createReel = (req, res, next) => publishPost(req, res, next, "reel");

export function recommendations(kind) {
    return async (req, res, next) => {
        try {
            const filter = kind === "reel" ? { kind } : { postedBy: { $ne: req.user._id }, kind: { $ne: "reel" } };
            const [interest, candidates] = await Promise.all([
                recentInterests(req.user),
                Post.find(filter).sort({ createdAt: -1, _id: -1 }).limit(120).maxTimeMS(3000).lean(),
            ]);
            const now = Date.now();
            const chosen = candidates.map((post) => ({ post, score: scorePost(post, interest, now) }))
                .sort((a, b) => b.score - a.score).slice(0, 24).map(({ post }) => post);
            await Post.populate(chosen, [
                { path: "postedBy", select: "username fullName profileImg" },
                { path: "likes", select: "username profileImg" },
            ]);
            return res.json(await presentPosts(chosen));
        } catch (error) {
            return next(error);
        }
    };
}

export async function getSavedIds(req, res, next) {
    try {
        const user = await User.findById(req.user._id).select("savedPosts").lean();
        return res.json(user?.savedPosts ?? []);
    } catch (error) {
        return next(error);
    }
}

export async function listSaved(req, res, next) {
    try {
        const user = await User.findById(req.user._id).select("savedPosts").lean();
        const ids = (user?.savedPosts ?? []).slice().reverse();
        const before = req.query.before;
        const offset = before === undefined ? 0 : ids.findIndex((id) => String(id) === before) + 1;
        if (before !== undefined && offset === 0) return res.status(400).json({ error: "Invalid saved page cursor." });
        const batch = ids.slice(offset, offset + 25);
        if (offset + batch.length < ids.length) res.set("X-Next-Cursor", String(batch.at(-1)));
        const posts = await Post.find({ _id: { $in: batch } }).maxTimeMS(3000)
            .populate("postedBy", "username fullName profileImg").populate("likes", "username profileImg").lean();
        const byId = new Map(posts.map((post) => [String(post._id), post]));
        return res.json(await presentPosts(batch.map((id) => byId.get(String(id))).filter(Boolean)));
    } catch (error) {
        return next(error);
    }
}

export async function savePost(req, res, next) {
    const { id } = req.params;
    const { saved } = req.body;
    if (!mongoose.isObjectIdOrHexString(id) || typeof saved !== "boolean") {
        return res.status(400).json({ error: "Invalid saved-post request." });
    }
    try {
        if (saved && !(await Post.exists({ _id: id }))) return res.status(404).json({ error: "Post not found." });
        const result = await User.updateOne({
            _id: req.user._id,
            ...(saved && { $or: [{ "savedPosts.499": { $exists: false } }, { savedPosts: id }] }),
        }, { [saved ? "$addToSet" : "$pull"]: { savedPosts: id } });
        if (!result.matchedCount) return res.status(409).json({ error: "Your saved list holds up to 500 posts." });
        return res.json({ saved });
    } catch (error) {
        return next(error);
    }
}

export const likePost = async (req, res) => {
    const { id } = req.params;
    const userId = req.user._id;
    if (!mongoose.isObjectIdOrHexString(id)) return res.status(404).json({ error: "Post not found" });
    try {
        const post = await Post.findById(id).select("postedBy likes");
        if (!post) return res.status(404).json({ error: "Post not found" });

        const liked = typeof req.body?.liked === "boolean" ? req.body.liked : !post.likes.includes(userId);
        const result = await Post.updateOne(
            { _id: id },
            liked ? { $addToSet: { likes: userId } } : { $pull: { likes: userId } },
        );
        if (!result.matchedCount) return res.status(404).json({ error: "Post not found" });
        postCache.invalidate(id.toLowerCase());
        if (liked && result.modifiedCount && !post.postedBy.equals(userId)) {
            await Notification.create({ type: "like", from: userId, to: post.postedBy, post: id })
                .then(() => getIO()?.to(getRecipientRoom(post.postedBy)).emit("activityChanged"))
                .catch((error) => console.error("Could not create like notification:", error.message));
        }
        return res.json({ liked });
    } catch (error) {
        console.error("Could not update like:", error.message);
        return res.status(500).json({ error: "Could not update like" });
    }
};


// ============================================================
// ADD REPLY
// ============================================================

export const addReply = async (req, res) => {

    try {

        const { comment } = req.body;
        const { id: postId } = req.params;
        const userId = req.user._id;


        // ----------------------------------------------------
        // Validate comment
        // ----------------------------------------------------

        if (!comment) {

            return res.status(400).json({
                message: "Comment required."
            });
        }


        // ----------------------------------------------------
        // Get user
        // ----------------------------------------------------

        const user = await User.findById(userId)
            .select(
                "profileImg username"
            );


        if (!user) {

            return res.status(404).json({
                message: "User not found"
            });
        }


        // ----------------------------------------------------
        // Get post
        // ----------------------------------------------------

        const post = await Post.findById(postId);


        if (!post) {

            return res.status(404).json({
                message: "Post not found"
            });
        }


        // ----------------------------------------------------
        // Create reply
        // ----------------------------------------------------

        const reply = {
            userId,
            comment,
            profileImg: user.profileImg,
            username: user.username
        };


        post.replies.push(reply);

        await post.save();
        postCache.invalidate(String(post._id));


        return res.status(200).json(
            { ...reply, profileImg: await mediaUrl(reply.profileImg) }
        );

    } catch (error) {

        console.error(
            "Error in addReply:",
            error.message
        );

        return res.status(500).json({
            message: error.message
        });
    }
};


// ============================================================
// DELETE POST
// ============================================================

export const DeletePost = async (req, res, next) => {
    try {
        const post = await Post.findOneAndDelete({ _id: req.params.id, postedBy: req.user._id });
        if (!post) return res.status(404).json({ error: "Post not found" });
        postCache.invalidate(String(post._id));
        await User.updateMany({ savedPosts: post._id }, { $pull: { savedPosts: post._id } }).catch((error) => {
            console.error("Saved list cleanup failed:", error.message);
        });
        await removeMedia([post.images, ...(post.media ?? []).map(({ key }) => key)]);
        return res.json({ message: "Post deleted successfully" });
    } catch (error) {
        return next(error);
    }
};


export const deletePostsUsersCollection = async (req, res) => {

    try {

        const collectionExists =
            await mongoose.connection.db
                .listCollections({
                    name: Post.collection.collectionName
                })
                .hasNext();


        if (!collectionExists) {

            return res.status(404).json({
                message: "MSG and Convo does not exist"
            });
        }


        // ----------------------------------------------------
        // Disabled intentionally
        // ----------------------------------------------------

        // await Post.collection.drop();
        // await User.collection.drop();
        // await Notification.collection.drop();


        await Message.collection.drop();

        await Conversation.collection.drop();


        return res.status(200).json({
            message: "msg,Convo deleted successfully"
        });

    } catch (error) {

        console.error(
            "Error deleting posts collection:",
            error
        );

        return res.status(500).json({
            error: "Internal server error"
        });
    }
};


// ============================================================
// SHARE POST
// ============================================================

export const sharepost = async (req, res, next) => {
    const { postId, conversationId, text = "" } = req.body;
    const sender = req.user._id;
    if (!mongoose.isObjectIdOrHexString(postId) || !mongoose.isObjectIdOrHexString(conversationId)
        || typeof text !== "string" || text.length > 4000) {
        return res.status(400).json({ error: "Choose a valid post and conversation." });
    }
    try {
        const { members, group } = await messageAudience(conversationId);
        if (!members.includes(String(sender))) return res.status(404).json({ error: "Conversation not found." });
        if (group && !group.owner.equals(sender) && (group.permissions?.canMessage === "owner"
            || (group.permissions?.canMessage === "admins" && !group.admins.some((admin) => admin.equals(sender))))) {
            return res.status(403).json({ error: "Only group managers can send messages here." });
        }
        const post = await Post.findById(postId).populate("postedBy", "username fullName profileImg");
        if (!post) return res.status(404).json({ error: "Post not found." });
        const postData = await presentPost(post);
        const note = text.trim();
        const encrypted = encrypt(note || "Shared a post");
        const fields = { text: encrypted.encryptedData, iv: encrypted.iv };
        const message = await Message.create({ conversationId, sender, type: "post", postReference: postId, ...fields });
        await saveConversationPreview(message, fields).catch((error) => console.error("Share preview failed:", error.message));
        const stats = await Post.findByIdAndUpdate(postId, {
            $inc: { shareCount: 1 },
            $push: { sharedBy: { $each: [{ userId: sender, sharedAt: new Date() }], $slice: -100 } },
        }, { new: true }).select("shareCount sharedBy").catch((error) => {
            console.error("Share count update failed:", error.message);
            return null;
        });
        postCache.invalidate(String(post._id));
        const payload = {
            ...message.toObject(), iv: undefined, text: note, postReference: { ...postData, images: postData.imageUrl },
            sender: await presentProfile({ _id: sender, username: req.user.username, profileImg: req.user.profileImg }),
        };
        const rooms = members.filter((id) => id !== String(sender)).map(getRecipientRoom);
        if (rooms.length && group) getIO()?.to(rooms).emit("newGroupMessage", { message: payload, conversationId, groupId: group._id });
        else if (rooms.length) getIO()?.to(rooms).emit("newMessage", payload);
        return res.json({ message: "Post shared successfully!", post: postData, postsharedBy: stats?.sharedBy,
            count: stats?.shareCount, postId, messageId: message._id });
    } catch (error) {
        return next(error);
    }
};


// ============================================================
// GET SINGLE POST
// ============================================================

export const getPost = async (req, res, next) => {
    const id = req.params.id;
    if (!mongoose.isObjectIdOrHexString(id)) return res.status(404).json({ error: "Post not found" });
    try {
        const post = await postCache.read(id.toLowerCase(), () => Post.findById(id)
            .populate("postedBy", "username fullName profileImg").populate("likes", "username profileImg").maxTimeMS(3000).lean().exec());
        if (!post) return res.status(404).json({ error: "Post not found" });
        return res.json(await presentPost(post));
    } catch (error) {
        return next(error);
    }
};


// ============================================================
// GET FEED POSTS
// ============================================================

export const getFeedPosts = async (req, res, next) => {
    try {
        const feedPosts = await Post.find({
            postedBy: { $in: [req.user._id, ...req.user.following] },
            ...beforeCursor(req.query.before),
        })
            .sort({ createdAt: -1, _id: -1 }).limit(26).maxTimeMS(3000)
            .populate("postedBy", "username fullName profileImg")
            .populate("likes", "username profileImg");
        return res.json(await presentPosts(sendCursor(res, feedPosts, 25)));
    } catch (error) {
        return next(error);
    }
};


// ============================================================
// GET USER POSTS
// ============================================================

export async function listAccountMedia(req, res, next) {
    try {
        const { view = "posts" } = req.query;
        if (!["posts", "reels", "liked", "replied"].includes(view)) return res.status(400).json({ error: "Unknown collection." });
        const userId = req.user._id;
        const filter = view === "liked" ? { likes: userId } : view === "replied" ? { "replies.userId": userId }
            : { postedBy: userId, kind: view === "reels" ? "reel" : { $ne: "reel" } };
        const rows = await Post.find({ ...filter, ...beforeCursor(req.query.before) })
            .sort({ createdAt: -1, _id: -1 }).limit(25).maxTimeMS(3000)
            .select("caption media images kind postedBy createdAt").populate("postedBy", "username").lean();
        return res.json(await presentPosts(sendCursor(res, rows, 24)));
    } catch (error) {
        return next(error);
    }
}

export const getUserPosts = async (req, res, next) => {
    try {
        const cursor = beforeCursor(req.query.before);
        const user = await User.findOne({ username: req.params.username }).select("_id").lean();
        if (!user) return res.status(404).json({ error: "User not found" });
        const posts = await Post.find({ postedBy: user._id, ...cursor })
            .sort({ createdAt: -1, _id: -1 }).limit(26).maxTimeMS(3000).populate("likes", "username profileImg");
        return res.json(await presentPosts(sendCursor(res, posts, 25)));
    } catch (error) {
        return next(error);
    }
};
