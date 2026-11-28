import mongoose from "mongoose";
import contentReference from "./contentReference.schema.js";
import musicSchema from "./music.schema.js";

const storySchema = new mongoose.Schema({
  author: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  mediaKey: { type: String, required() { return this.kind === "image" || this.kind === "video"; } },
  kind: { type: String, enum: ["image", "video", "shared", "canvas"], required: true },
  sharedContent: contentReference,
  composition: mongoose.Schema.Types.Mixed,
  music: musicSchema,
  caption: { type: String, default: "", maxlength: 220 },
  expiresAt: { type: Date, required: true, index: true },
}, { timestamps: true });
storySchema.index({ author: 1, _id: 1 });
storySchema.index({ author: 1, expiresAt: 1 });

const likeSchema = new mongoose.Schema({
  story: { type: mongoose.Schema.Types.ObjectId, ref: "Story", required: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  expiresAt: { type: Date, required: true },
});
likeSchema.index({ story: 1, user: 1 }, { unique: true });
likeSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const Story = mongoose.model("Story", storySchema);
export const StoryLike = mongoose.model("StoryLike", likeSchema);
