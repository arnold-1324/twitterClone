import mongoose from "mongoose";

const schema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  version: { type: Number, required: true },
  generation: { type: Number, default: 0 },
  digest: { type: String, required: true, select: false },
  expiresAt: { type: Date, required: true },
  revokedAt: Date,
}, { timestamps: true });

schema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
export default mongoose.model("Session", schema);
