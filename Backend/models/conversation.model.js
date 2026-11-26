import mongoose from "mongoose";

const conversationSchema = new mongoose.Schema(
  {
    participants: [{ type: mongoose.Schema.Types.ObjectId, ref: "User", required: true }],
    directKey: String,
    kind: { type: String, enum: ["direct", "group"] },
    lastMessage: {
      messageId: mongoose.Schema.Types.ObjectId,
      sentAt: Date,
      text: String,
      iv: String,
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
