import { afterEach, expect, jest, test } from "@jest/globals";
import mongoose from "mongoose";
import Conversation from "../models/conversation.model.js";
import Group from "../models/group.model.js";
import { createCallHandler } from "../socket/calls.js";

afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

function directCall() {
  const participants = [new mongoose.Types.ObjectId(), new mongoose.Types.ObjectId()];
  const conversationId = String(new mongoose.Types.ObjectId());
  const room = (user) => `account:${user}`;
  const emit = jest.fn();
  const rooms = new Map(participants.map((user) => [room(user), new Set([String(user)])]));
  const io = { sockets: { adapter: { rooms } }, to: () => ({ emit }) };
  const saveHistory = jest.fn().mockResolvedValue({ conversationId });
  const bind = createCallHandler(io, room, saveHistory);
  jest.spyOn(Conversation, "findOne").mockReturnValue({
    select: () => ({ lean: async () => ({ _id: conversationId, participants }) }),
  });
  jest.spyOn(Group, "exists").mockResolvedValue(null);

  const clients = participants.map((userId, index) => {
    const events = new Map();
    bind({
      id: String(userId), connected: true, data: { userId: String(userId), username: `person${index}` },
      on: (event, handler) => events.set(event, handler), to: () => ({ emit }),
    });
    return (event, ...args) => events.get(event)(...args);
  });
  async function start(mode) {
    const acknowledge = jest.fn();
    await clients[0]("call:start", { conversationId, mode }, acknowledge);
    return acknowledge.mock.calls[0][0];
  }
  return { start, clients, saveHistory, emit };
}

test("a completed call records one result with time measured after both peers connect", async () => {
  jest.useFakeTimers();
  const { start, clients: [caller, callee], saveHistory, emit } = directCall();
  const { id } = await start("video");
  callee("call:accept", { id }, jest.fn());
  caller("call:connected", { id });
  jest.advanceTimersByTime(4000);
  callee("call:connected", { id });
  jest.advanceTimersByTime(2300);
  caller("call:end", { id });
  callee("call:end", { id });
  await Promise.resolve();

  expect(saveHistory).toHaveBeenCalledTimes(1);
  expect(saveHistory).toHaveBeenCalledWith(
    expect.objectContaining({ mode: "video" }), "completed", expect.any(Date), 2,
  );
  expect(emit).toHaveBeenCalledWith("newMessage", expect.objectContaining({ conversationId: expect.any(String) }));
});

test("an unanswered call records a missed voice call without a duration", async () => {
  jest.useFakeTimers();
  const { start, saveHistory } = directCall();
  await start("audio");
  jest.advanceTimersByTime(30000);
  expect(saveHistory).toHaveBeenCalledWith(
    expect.objectContaining({ mode: "audio" }), "missed", expect.any(Date), undefined,
  );
});
