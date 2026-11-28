import mongoose from "mongoose";

const schema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  conversation: { type: mongoose.Schema.Types.ObjectId, ref: "Conversation", required: true },
  through: { type: String, required: true },
}, { versionKey: false });

schema.index({ user: 1, conversation: 1 }, { unique: true });

export default mongoose.model("MessageRead", schema);
