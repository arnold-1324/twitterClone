import Post from "../models/post.model.js";

export function extractTopics(caption) {
  return [...new Set(Array.from(caption.matchAll(/#([\p{L}\p{N}_]{1,32})(?![\p{L}\p{N}_])/gu),
    ([, tag]) => tag.normalize("NFKC").toLowerCase()))].slice(0, 8);
}

export async function recentInterests(account) {
  const followed = (account.following ?? []).slice(0, 80);
  const [liked, authored] = await Promise.all([
    Post.find({ likes: account._id }).sort({ createdAt: -1 }).limit(24).select("topics").lean().maxTimeMS(2000),
    Post.find({ postedBy: { $in: [account._id, ...followed] } }).sort({ createdAt: -1 })
      .limit(32).select("topics").lean().maxTimeMS(2000),
  ]);
  const weights = new Map();
  for (const [posts, weight] of [[liked, 3], [authored, 1]]) {
    for (const post of posts) for (const topic of post.topics ?? []) weights.set(topic, (weights.get(topic) ?? 0) + weight);
  }
  return { weights, followed: new Set(followed.map(String)) };
}

export function scorePost(post, { weights, followed }, now = Date.now()) {
  const hours = Math.max(0, (now - new Date(post.createdAt).getTime()) / 3600000);
  const interest = (post.topics ?? []).reduce((sum, topic) => sum + Math.min(6, weights.get(topic) ?? 0), 0);
  const engagement = Math.log1p((post.likes?.length ?? 0) + 2 * (post.replies?.length ?? 0) + (post.shareCount ?? 0));
  return 3 * Math.exp(-hours / 96) + (followed.has(String(post.postedBy)) ? 2 : 0)
    + Math.min(6, interest / 3) + Math.min(2, engagement / 2);
}
