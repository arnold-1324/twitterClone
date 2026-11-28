import mongoose from "mongoose";

export default new mongoose.Schema({
  id: String, style: String, start: Number, duration: Number, x: Number, y: Number, size: Number,
}, { _id: false });
