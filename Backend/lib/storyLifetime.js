import { Story } from "../models/story.model.js";
import User from "../models/user.model.js";
import { removeMedia } from "./mediaStore.js";

export const day = 86400000;
export const activeStory = () => ({ expiresAt: { $gt: new Date() } });

export async function findVisibleStory(id) {
  const story = await Story.findOne({ _id: id, ...activeStory() }).lean();
  if (!story || !await User.exists({ _id: story.author, isFrozen: { $ne: true } })) return null;
  return story;
}

export function startStoryCleanup() {
  let running = false;
  async function sweep() {
    if (running) return;
    running = true;
    try {
      const expired = await Story.find({ expiresAt: { $lte: new Date() } })
        .select("mediaKey").sort({ expiresAt: 1 }).limit(40).lean();
      for (const { _id, mediaKey } of expired) {
        if (await removeMedia([mediaKey])) await Story.deleteOne({ _id });
      }
    } catch (error) {
      console.error("Story cleanup:", error.message);
    } finally {
      running = false;
    }
  }
  void sweep();
  setInterval(sweep, 60000).unref();
}
