import { afterEach, beforeAll, expect, jest, test } from "@jest/globals";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import request from "supertest";
import Post from "../models/post.model.js";
import Session from "../models/session.model.js";
import User from "../models/user.model.js";

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

test("feed includes the signed-in author and followed authors", async () => {
  jest.spyOn(Session, "exists").mockResolvedValue({ _id: sid });
  jest.spyOn(User, "findById").mockReturnValue({ select: async () => ({ _id: account, following: [followed] }) });
  const query = { sort: jest.fn().mockReturnThis(), limit: jest.fn().mockReturnThis(), maxTimeMS: jest.fn().mockReturnThis(), populate: jest.fn().mockReturnThis(), then: (resolve) => resolve([]) };
  const find = jest.spyOn(Post, "find").mockReturnValue(query);
  await request(app).get("/api/posts/feed").set("Cookie", session()).expect(200, []);
  expect(find).toHaveBeenCalledWith({ postedBy: { $in: [account, followed] } });
});
