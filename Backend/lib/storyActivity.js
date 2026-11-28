import StoryActivity from "../models/storyActivity.model.js";

export async function recordStoryActivity(story, viewer, event, reaction) {
  if (event === "view" && String(story.author) === String(viewer)) return;
  const filter = { story: story._id, viewer };
  const mutation = event === "view" ? { $max: { viewedAt: new Date() } }
    : event === "reaction" ? { $set: { reaction } } : { $inc: { [event]: 1 } };
  try {
    await StoryActivity.updateOne(filter, {
      ...mutation,
      $setOnInsert: { expiresAt: story.expiresAt },
    }, { upsert: true, setDefaultsOnInsert: false });
  } catch (error) {
    if (error.code !== 11000) throw error;
    await StoryActivity.updateOne(filter, mutation);
  }
}

export const viewedStoryLookup = (viewer) => ({
  $lookup: { from: StoryActivity.collection.name, localField: "_id", foreignField: "story",
    pipeline: [{ $match: { viewer, viewedAt: { $ne: null } } }, { $project: { _id: 1 } }], as: "views" },
});
