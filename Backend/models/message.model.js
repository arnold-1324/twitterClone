import mongoose from "mongoose";

const pollOptionSchema = new mongoose.Schema({
    optionText: { type: String, required: true },
    votes: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
});

const pollSchema = new mongoose.Schema({
    question: { type: String, required: true },
    options: [pollOptionSchema],
    totalVotes: { type: Number, default: 0 },
    multiSelect: { type: Boolean, default: false },
    expiresAt: { type: Date, default: null },
    closed: { type: Boolean, default: false },
}, { _id: false });

const callSchema = new mongoose.Schema({
    mode: { type: String, enum: ["audio", "video"], required: true },
    outcome: {
        type: String,
        enum: ["completed", "missed", "declined", "canceled", "failed", "offline", "busy", "interrupted"],
        required: true,
    },
    durationSeconds: { type: Number, min: 0, max: 7200 },
}, { _id: false });

const locationSchema = new mongoose.Schema({
    mode: { type: String, enum: ["current", "live"], required: true },
    iv: String,
    encryptedData: String,
    updatedAt: Date,
    expiresAt: Date,
    stoppedAt: Date,
    revision: { type: Number, default: 0 },
}, { _id: false });

const messageSchema = new mongoose.Schema(
    {
        conversationId: { type: mongoose.Schema.Types.ObjectId, ref: "Conversation" },
        sender: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        text: {
            type: String,
            default: "",
        },
        type: {
            type: String,
            enum: ["text", "image", "video","post","audio","file","poll", "location", "bundle"],
            default: "text",
        },
        iv: {
      type: String,
      required: function () {
        return this.text && typeof this.text === "string" && this.text.trim().length > 0;
      },
    },
        poll: {
            type: pollSchema,
            required: function () { return this.type === "poll"; },
        },
        call: callSchema,
        storyReference: {
            id: { type: mongoose.Schema.Types.ObjectId, ref: "Story" },
            username: String,
            purpose: { type: String, enum: ["reply", "share", "mention"] },
            video: Boolean,
        },
        noteReply: Boolean,
        noteReference: {
            author: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
            version: Date,
        },
        attachment: {
            name: String,
            size: Number,
            extension: String,
            kind: String,
        },
        attachments: [{
            _id: false,
            kind: { type: String, enum: ["image", "video", "audio", "file"], required: true },
            key: { type: String, required: true },
            attachment: {
                name: String,
                size: Number,
                extension: String,
                kind: String,
            },
        }],
        location: locationSchema,
        mentions: [{
            _id: false,
            user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
            username: { type: String, required: true },
        }],
        seen: {
            type: Boolean,
            default: false,
        },
        img: {
            type: String,
            default: "",
        },
        file: { type: String, default: "" },
        audio: {
            type: String,
            default: "",
        },
        video:{
            type:String,
            default: "",    
        },

        postReference: { type: mongoose.Schema.Types.ObjectId, ref: 'Post', default: null },

        reactions: [
            {
                user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
                type: { type: String }, 
            },
        ],
        edited: {
            type: Boolean,
            default: false,
        },
        replyTo: { type: mongoose.Schema.Types.ObjectId, ref: "Message", default: null }, 
        deletedFor: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }], 
    },
    { timestamps: true }
);

messageSchema.pre("validate", function () {
  // Older ordinary messages could have an empty poll object from nested defaults.
  if (this.type !== "poll" && this.poll) this.poll = undefined;
});

messageSchema.pre("save", function (next) {
  if (this.type === "poll" && this.poll?.options) {
    this.poll.totalVotes = this.poll.options.reduce(
      (sum, opt) => sum + opt.votes.length,
      0
    );
  }
  next();
});


messageSchema.index({ conversationId: 1, createdAt: 1 });
messageSchema.index({ conversationId: 1, createdAt: -1, _id: -1 });

const Message = mongoose.model("Message", messageSchema);

export default Message;
