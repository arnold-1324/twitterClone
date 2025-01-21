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
    sharedBy: [{
        userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        sharedAt: { type: Date, default: Date.now },
    }],
    shareCount: { type: Number, default: 0 },
}, {
    timestamps: true,
});

const Post = mongoose.model('Post', postSchema);

export default Post;
