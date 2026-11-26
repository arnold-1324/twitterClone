import { afterEach, expect, jest, test } from "@jest/globals";
import { createHash } from "node:crypto";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import Session from "../models/session.model.js";
import User from "../models/user.model.js";
import { generateTokenAndCookies, readAccessSession, rotateRefresh } from "../lib/utils/generateToken.js";

afterEach(() => jest.restoreAllMocks());

test("refresh rotation stores a digest and revokes genuine replay", async () => {
  process.env.JWT_SECRET = "session-unit-test-secret";
  const user = { _id: new mongoose.Types.ObjectId(), sessionVersion: 4 };
  const res = { cookie: jest.fn() };
  const create = jest.spyOn(Session, "create").mockImplementation(async (value) => ({ ...value, generation: 0 }));
  await generateTokenAndCookies(user, res);
  const original = res.cookie.mock.calls.find(([name]) => name === "refresh")[1];
  const access = res.cookie.mock.calls.find(([name]) => name === "jwt")[1];
  const stored = create.mock.calls[0][0];
  expect(stored.digest).toBe(createHash("sha256").update(original).digest("hex"));
  expect(jwt.decode(access).exp - jwt.decode(access).iat).toBe(900);
  expect(await readAccessSession(original)).toBeNull();

  jest.spyOn(Session, "findOne").mockReturnValue({ select: async () => ({ ...stored, generation: 0 }) });
  jest.spyOn(User, "findById").mockReturnValue({ select: async () => user });
  const rotate = jest.spyOn(Session, "findOneAndUpdate").mockResolvedValueOnce({ ...stored, generation: 1 }).mockResolvedValueOnce(null);
  const revoke = jest.spyOn(Session, "updateOne").mockResolvedValue({ modifiedCount: 1 });
  const response = { cookie: jest.fn() };
  expect(await rotateRefresh(original, response)).toEqual({ ok: true });
  expect(rotate.mock.calls[0][0].digest).toBe(stored.digest);
  expect(response.cookie.mock.calls.find(([name]) => name === "refresh")[1]).not.toBe(original);
  expect(await rotateRefresh(original, res)).toEqual({ ok: false, revoked: String(stored._id) });
  expect(revoke.mock.calls[0][0].generation).toEqual({ $gt: 0 });
});
