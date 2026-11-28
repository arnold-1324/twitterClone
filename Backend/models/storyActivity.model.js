import mongoose from "mongoose";

const schema = new mongoose.Schema({
  story: { type: mongoose.Schema.Types.ObjectId, ref: "Story", required: true },
  viewer: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  expiresAt: { type: Date, required: true },
  viewedAt: Date,
  reaction: String,
  replied: { type: Number, default: 0 },
  shared: { type: Number, default: 0 },
}, { versionKey: false });

schema.index({ story: 1, viewer: 1 }, { unique: true });
schema.index({ story: 1, viewedAt: -1, _id: -1 });
schema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default mongoose.model("StoryActivity", schema);
