import mongoose from "mongoose";

const notificationSchema = new mongoose.Schema({
    from: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
    },
    to: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
    },
    type: {
        type: String,
        required: true,
        enum: ["follow", "followRequest", "like", "retweet"],
    },
    post: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Post", 
        default: null,
    },
    action: {
        type: String,
        enum: ["requestSent", "requestAccepted", "requestRejected"],
        default: null,
    },
    read: {
        type: Boolean,
        default: false,
    },
    message: {
        type: String,
        default: "", 
    },
}, { timestamps: true });

const Notification = mongoose.model('Notification', notificationSchema);

export default Notification;
