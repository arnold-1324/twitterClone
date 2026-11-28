import mongoose from "mongoose";
import contentReference from "./contentReference.schema.js";
import musicSchema from "./music.schema.js";

const postSchema = new mongoose.Schema({
    postedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    caption: {
        type: String,
        maxLength: 280,
    },
    images: {
        type: String
    },
    kind: { type: String, enum: ["post", "reel"], default: "post" },
    sharedContent: contentReference,
    music: musicSchema,
    media: [{
        _id: false,
        key: { type: String, required: true },
        type: { type: String, enum: ["image", "video"], required: true },
        credit: {
            title: String,
            creator: String,
            source: String,
            original: String,
            license: String,
            licenseUrl: String,
            changes: String,
        },
    }],
    topics: [String],
    likes: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
    }],
    repostedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    replies: [{
        parentId: mongoose.Schema.Types.ObjectId,
        likes: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },
        comment: {
            type: String,
            default: "",
        },
        mediaKey: String,
        profileImg: {
            type: String,
            default: "",
        },
        username: {
            type: String,
            required: true,
        },
        
        createdAt: {
            type: Date,
            default: Date.now,
        },
    }],
    sharedBy: [{
        userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        sharedAt: { type: Date, default: Date.now },
    }],
    shareCount: { type: Number, default: 0 },
}, {
    timestamps: true,
});

postSchema.index({ postedBy: 1, createdAt: -1, _id: -1 });
postSchema.index({ repostedBy: 1, createdAt: -1, _id: -1 });

postSchema.index({ kind: 1, createdAt: -1, _id: -1 });
postSchema.index({ likes: 1, createdAt: -1 });
postSchema.index({ "replies.userId": 1, createdAt: -1, _id: -1 });
postSchema.index({ topics: 1, createdAt: -1 });
postSchema.index({ createdAt: -1, _id: -1 });

const Post = mongoose.model('Post', postSchema);

export default Post;
