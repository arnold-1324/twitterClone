import mongoose from "mongoose";

export const musicCategories = ["tamil", "tamil-christian", "english", "hindi", "malayalam"];

const trackSchema = new mongoose.Schema({
  _id: String,
  title: { type: String, required: true },
  artist: { type: String, required: true },
  album: String,
  composer: String,
  year: String,
  genre: String,
  artworkKey: String,
  metadata: { type: Map, of: String },
  category: { type: String, enum: musicCategories, required: true },
  tags: [String],
  duration: { type: Number, required: true },
  objectKey: { type: String, required: true },
  bytes: { type: Number, required: true },
  license: { type: String, required: true },
  licenseUrl: String,
  source: String,
  searchText: { type: String, required: true },
}, { timestamps: true });
trackSchema.index({ category: 1, title: 1 });

const eventSchema = new mongoose.Schema({
  _id: String,
  user: { type: mongoose.Schema.Types.ObjectId, required: true },
  kind: { type: String, enum: ["search", "clip"], required: true },
  tracks: [String],
  start: Number,
  duration: Number,
  surface: { type: String, enum: ["story", "post", "reel", "note"] },
  day: { type: Date, required: true },
  expiresAt: { type: Date, required: true },
});
eventSchema.index({ kind: 1, user: 1, day: -1 });
eventSchema.index({ kind: 1, tracks: 1, day: -1 });
eventSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const LibraryTrack = mongoose.model("LibraryTrack", trackSchema);
export const MusicEvent = mongoose.model("MusicEvent", eventSchema);
