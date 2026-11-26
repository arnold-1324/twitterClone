import { expect, test } from "@jest/globals";
import { extractTopics, scorePost } from "../lib/recommendations.js";

test("topics are normalized, deduplicated, and bounded", () => {
  expect(extractTopics("#Photo #PHOTO #café #東京")).toEqual(["photo", "café", "東京"]);
  expect(extractTopics("#a #b #c #d #e #f #g #h #i")).toHaveLength(8);
});

test("matching topics and followed creators lift relevant posts", () => {
  const now = Date.UTC(2026, 0, 1);
  const interest = { weights: new Map([["photo", 6]]), followed: new Set(["a"]) };
  const base = { createdAt: new Date(now) };
  expect(scorePost({ ...base, postedBy: "a", topics: ["photo"] }, interest, now))
    .toBeGreaterThan(scorePost({ ...base, postedBy: "b", topics: ["sports"] }, interest, now));
});
