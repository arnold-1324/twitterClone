import mongoose from "mongoose";

const schema = new mongoose.Schema({
  _id: { type: String, required: true },
  post: { type: mongoose.Schema.Types.ObjectId, ref: "Post", required: true },
  expiresAt: { type: Date, required: true },
}, { versionKey: false });
schema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
schema.index({ post: 1, expiresAt: 1 });

export default mongoose.model("PostView", schema);
