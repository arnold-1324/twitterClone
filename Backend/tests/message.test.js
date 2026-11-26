import { afterEach, expect, jest, test } from "@jest/globals";
import mongoose from "mongoose";
import Conversation from "../models/conversation.model.js";
import Group from "../models/group.model.js";
import { belongsToConversation } from "../socket/socket.js";

afterEach(() => jest.restoreAllMocks());

test("group blocking takes precedence over the conversation's participant list", async () => {
  const account = new mongoose.Types.ObjectId();
  jest.spyOn(Group, "findOne").mockReturnValue({
    select: () => ({ lean: async () => ({ members: [account], blocked: [account] }) }),
  });
  const direct = jest.spyOn(Conversation, "exists");
  expect(await belongsToConversation(new mongoose.Types.ObjectId(), account)).toBe(false);
  expect(direct).not.toHaveBeenCalled();
});

test("direct conversations are scoped to their participants", async () => {
  const account = new mongoose.Types.ObjectId();
  const conversation = new mongoose.Types.ObjectId();
  jest.spyOn(Group, "findOne").mockReturnValue({ select: () => ({ lean: async () => null }) });
  const direct = jest.spyOn(Conversation, "exists").mockResolvedValue({ _id: conversation });
  expect(await belongsToConversation(conversation, account)).toBe(true);
  expect(direct).toHaveBeenCalledWith({ _id: conversation, kind: { $ne: "group" }, participants: account });
});
