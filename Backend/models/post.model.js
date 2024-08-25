import mongoose from "mongoose";

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
    likes: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
    }],
    retweetData: {
        isRetweet: {
            type: Boolean,
            default: false,
        },
        originalPost: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Post',
        },
        comment: {
            type: String,
            maxLength: 280,
        },
    },
    replies: [{
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },
        comment: {
            type: String,
            required: true,
        },
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
}, {
    timestamps: true,
});

const Post = mongoose.model('Post', postSchema);

export default Post;
