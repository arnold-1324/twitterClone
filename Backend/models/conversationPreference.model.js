import mongoose from "mongoose";

const schema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  conversation: { type: mongoose.Schema.Types.ObjectId, ref: "Conversation", required: true },
  pinned: { type: Boolean, default: false },
  archived: { type: Boolean, default: false },
  revision: { type: Number, default: 0 },
});

schema.index({ user: 1, conversation: 1 }, { unique: true });
schema.index({ conversation: 1 });

export default mongoose.model("ConversationPreference", schema);
