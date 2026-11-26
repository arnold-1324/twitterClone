import { afterEach, expect, jest, test } from "@jest/globals";
import User from "../models/user.model.js";
import { getUserProfile } from "../controller/user.controller.js";

afterEach(() => jest.restoreAllMocks());

test("public profile queries exclude email and password reset fields", async () => {
  const profile = { username: "person" };
  const projection = jest.fn().mockResolvedValue(profile);
  jest.spyOn(User, "findOne").mockReturnValue({ select: projection });
  const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };

  await getUserProfile({ params: { query: "person" } }, res);
  expect(projection.mock.calls[0][0].split(" ")).toEqual(expect.arrayContaining(["-email", "-password"]));
  expect(User.schema.path("resetPasswordToken").options.select).toBe(false);
  expect(User.schema.path("resetPasswordExpires").options.select).toBe(false);
  expect(res.json).toHaveBeenCalledWith(profile);
});
