import { afterEach, expect, jest, test } from "@jest/globals";
import mongoose from "mongoose";
import Notification from "../models/notification.model.js";
import { getNotifications } from "../controller/notification.controller.js";

afterEach(() => jest.restoreAllMocks());

test("a badge refresh does not mark notifications read", async () => {
  const items = [{ _id: new mongoose.Types.ObjectId(), read: false }];
  const query = { sort: jest.fn().mockReturnThis(), limit: jest.fn().mockReturnThis(), maxTimeMS: jest.fn().mockReturnThis(), populate: jest.fn().mockReturnThis(), then: (resolve) => resolve(items) };
  jest.spyOn(Notification, "find").mockReturnValue(query);
  const markRead = jest.spyOn(Notification, "updateMany");
  const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };

  await getNotifications({ user: { _id: new mongoose.Types.ObjectId() }, query: { markRead: "false" } }, res);
  expect(res.json).toHaveBeenCalledWith(items);
  expect(markRead).not.toHaveBeenCalled();
});
