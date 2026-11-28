import { afterEach, beforeAll, expect, jest, test } from "@jest/globals";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import request from "supertest";
import Post from "../models/post.model.js";
import Session from "../models/session.model.js";
import User from "../models/user.model.js";
import { searchTopics } from "../controller/post.controller.js";

let app;
const account = new mongoose.Types.ObjectId();
const sid = new mongoose.Types.ObjectId();
const followed = new mongoose.Types.ObjectId();
const secret = "test-signing-key";
function session() {
  return `jwt=${jwt.sign({ userId: account, sid: String(sid), sessionVersion: 0 }, secret, { audience: "dayline-access", expiresIn: "15m" })}`;
}

beforeAll(async () => {
  process.env.JWT_SECRET = secret;
  process.env.ENCRYPTION_SECRET ||= "test-encryption-key";
  ({ default: app } = await import("../app.js"));
});
afterEach(() => jest.restoreAllMocks());

test("rejects blank captions before writing a post", async () => {
  jest.spyOn(Session, "exists").mockResolvedValue({ _id: sid });
  jest.spyOn(User, "findById").mockReturnValue({ select: async () => ({ _id: account }) });
  const save = jest.spyOn(Post.prototype, "save");
  await request(app).post("/api/posts/create").set("Cookie", session()).field("caption", "   ").expect(400);
  expect(save).not.toHaveBeenCalled();
});

test("home feed includes the signed-in author, followers, and followed authors", async () => {
  const follower = new mongoose.Types.ObjectId();
  jest.spyOn(Session, "exists").mockResolvedValue({ _id: sid });
  jest.spyOn(User, "findById").mockReturnValue({ select: async () => ({
    _id: account, following: [followed], followers: [followed, follower],
  }) });
  jest.spyOn(Post, "aggregate").mockReturnValue({ option: async () => [] });
  const query = { sort: jest.fn().mockReturnThis(), limit: jest.fn().mockReturnThis(), maxTimeMS: jest.fn().mockReturnThis(), populate: jest.fn().mockReturnThis(), then: (resolve) => resolve([]) };
  const find = jest.spyOn(Post, "find").mockReturnValue(query);
  await request(app).get("/api/posts/feed").set("Cookie", session()).expect(200, []);
  expect(find).toHaveBeenCalledWith({ postedBy: { $in: [account, followed, follower] } });
});

test("topic suggestions normalize hashtags and return the bounded aggregation", async () => {
  const topics = [{ topic: "nature", postCount: 4 }];
  jest.spyOn(Post, "aggregate").mockReturnValue({ option: async () => topics });
  const res = { set: jest.fn(), json: jest.fn() };

  await searchTopics({ query: { q: "#Nature" } }, res, jest.fn());

  const pipeline = Post.aggregate.mock.calls[0][0];
  expect(pipeline[0].$match.topics.$regex).toBe("^nature");
  expect(pipeline.some((stage) => stage.$limit === 8)).toBe(true);
  expect(res.set).toHaveBeenCalledWith("Cache-Control", "private, no-store");
  expect(res.json).toHaveBeenCalledWith(topics);
});

test("topic suggestions reject non-topic input before querying MongoDB", async () => {
  const aggregate = jest.spyOn(Post, "aggregate");
  const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };

  await searchTopics({ query: { q: "nature.*" } }, res, jest.fn());

  expect(res.status).toHaveBeenCalledWith(400);
  expect(aggregate).not.toHaveBeenCalled();
});
