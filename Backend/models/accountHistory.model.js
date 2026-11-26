import mongoose from "mongoose";

export const historyKinds = ["name", "username", "bio", "photo", "privacy", "password"];
const schema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, required: true, ref: "User" },
  kind: { type: String, enum: historyKinds, required: true },
  action: { type: String, enum: ["changed", "removed", "hidden", "visible"], default: "changed" },
  profileValue: { type: String, maxlength: 500 },
}, { timestamps: { createdAt: true, updatedAt: false } });
schema.index({ user: 1, createdAt: -1, _id: -1 });
schema.index({ user: 1, kind: 1, createdAt: -1, _id: -1 });
export default mongoose.model("AccountHistory", schema);
