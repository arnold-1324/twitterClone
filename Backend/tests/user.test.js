import { afterEach, expect, jest, test } from "@jest/globals";
import User from "../models/user.model.js";
import Post from "../models/post.model.js";
import { getUserProfile, searchUsers } from "../controller/user.controller.js";
import { peopleCache } from "../lib/readCache.js";

afterEach(() => {
  jest.restoreAllMocks();
  peopleCache.clear();
});

test("public profile queries exclude email and password reset fields", async () => {
  const profile = { username: "person" };
  const projection = jest.fn().mockResolvedValue(profile);
  jest.spyOn(User, "findOne").mockReturnValue({ select: projection });
  jest.spyOn(Post, "countDocuments").mockReturnValue({ maxTimeMS: async () => 3 });
  const mutualQuery = {
    select: () => mutualQuery,
    maxTimeMS: () => mutualQuery,
    lean: async () => [],
  };
  jest.spyOn(User, "find").mockReturnValue(mutualQuery);
  const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };

  await getUserProfile({ params: { query: "person" } }, res);
  expect(projection.mock.calls[0][0].split(" ")).toEqual(expect.arrayContaining(["-email", "-password"]));
  expect(User.schema.path("resetPasswordToken").options.select).toBe(false);
  expect(User.schema.path("resetPasswordExpires").options.select).toBe(false);
  expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ username: "person", postsCount: 3, mutuals: [] }));
});

test("account search includes public summary fields and excludes the current account", async () => {
  const self = { _id: "self", username: "devself" };
  const match = {
    _id: "match",
    username: "devfriend",
    fullName: "Dev Friend",
    profileImg: "",
    isVerified: true,
    followersCount: 7,
  };
  jest.spyOn(User, "aggregate").mockReturnValue({ option: async () => [self, match] });
  const res = { set: jest.fn(), json: jest.fn() };

  await searchUsers({ query: { q: "dev" }, user: { _id: "self" } }, res, jest.fn());

  expect(User.aggregate.mock.calls[0][0][0].$match.isFrozen).toEqual({ $ne: true });
  expect(res.set).toHaveBeenCalledWith("Cache-Control", "private, no-store");
  expect(res.json).toHaveBeenCalledWith([match]);
});
