import { afterEach, expect, jest, test } from "@jest/globals";
import mongoose from "mongoose";
import Conversation from "../models/conversation.model.js";
import Group from "../models/group.model.js";
import Message from "../models/message.model.js";
import { belongsToConversation } from "../socket/socket.js";

afterEach(() => jest.restoreAllMocks());

test.each(["text", "image", "audio", "file"])("%s messages omit the poll field required by Atlas only when present", async (type) => {
  const message = new Message({ type, conversationId: new mongoose.Types.ObjectId(), sender: new mongoose.Types.ObjectId() });
  await message.validate();
  expect(message.toBSON()).not.toHaveProperty("poll");
});

test("poll messages require a question and continue to include their defaults", async () => {
  const message = new Message({ type: "poll" });
  await expect(message.validate()).rejects.toThrow("Path \`poll\` is required");
  message.poll = { question: "Lunch?", options: [{ optionText: "Yes" }, { optionText: "No" }] };
  await message.validate();
  expect(message.toBSON().poll).toMatchObject({ question: "Lunch?", totalVotes: 0, multiSelect: false, closed: false });
});

test("saving a legacy non-poll message drops its empty poll fields", async () => {
  const legacy = Message.hydrate({ type: "text", poll: { options: [], totalVotes: 0 } });
  await legacy.validate();
  expect(legacy.toBSON()).not.toHaveProperty("poll");
});

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
