import mongoose from "mongoose";

export default new mongoose.Schema({
  type: { type: String, enum: ["story", "post"], required: true },
  id: { type: mongoose.Schema.Types.ObjectId, required: true },
}, { _id: false });
