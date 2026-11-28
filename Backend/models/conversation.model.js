import mongoose from "mongoose";
import { chatBackgrounds, chatFonts } from "../lib/chatBackgrounds.js";

const conversationSchema = new mongoose.Schema(
  {
    participants: [{ type: mongoose.Schema.Types.ObjectId, ref: "User", required: true }],
    directKey: String,
    kind: { type: String, enum: ["direct", "group"] },
    snowfall: { type: Boolean, default: false },
    backgroundTheme: { type: String, enum: [...chatBackgrounds, "custom"], default: "default" },
    customBackgroundKey: String,
    chatFont: { type: String, enum: chatFonts, default: "default" },
    themeRevision: { type: Number, default: 0 },
    lastMessage: {
      messageId: mongoose.Schema.Types.ObjectId,
      sentAt: Date,
      text: String,
      iv: String,
      mentionedUsers: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
      sender: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      seen: {
        type: Boolean,
        default: false,
      },
    },
  },
  { timestamps: true }
);

conversationSchema.index({ participants: 1 });

conversationSchema.index({ directKey: 1 }, { unique: true, partialFilterExpression: { directKey: { $type: "string" } } });

const Conversation = mongoose.model("Conversation", conversationSchema);

export default Conversation;
