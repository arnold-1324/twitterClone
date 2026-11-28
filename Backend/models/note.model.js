import mongoose from "mongoose";

export const noteThemes = ["ink", "mint", "plum", "rose", "sky", "amber"];

const schema = new mongoose.Schema({
  _id: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  text: { type: String, default: "", maxlength: 120 },
  theme: { type: String, enum: noteThemes, default: "ink" },
  trackId: String,
  albumId: String,
  musicId: String,
  musicStart: Number,
  musicDuration: Number,
  expiresAt: { type: Date, required: true },
}, { timestamps: true });
schema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default mongoose.model("Note", schema);
