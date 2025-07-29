import mongoose from "mongoose";

const groupSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: String,
  owner: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  admins: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  members: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  invites: [{
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    status: { type: String, enum: ["pending", "accepted", "denied"], default: "pending" }
  }],
  permissions: {
    canMessage: { type: String, enum: ["all", "admins", "owner"], default: "all" }
  },
  blocked: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  conversation: { type: mongoose.Schema.Types.ObjectId, ref: "Conversation" },
  messages: [{ type: mongoose.Schema.Types.ObjectId, ref: "Message" }]
}, { timestamps: true });

export default mongoose.model("Group", groupSchema);
