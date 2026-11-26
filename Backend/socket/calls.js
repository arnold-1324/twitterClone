import { randomUUID } from "node:crypto";
import mongoose from "mongoose";
import Conversation from "../models/conversation.model.js";
import Group from "../models/group.model.js";
import { takeSocket } from "../lib/rateLimits.js";

export function createCallHandler(io, accountRoom) {
  const byUser = new Map();

  function finish(call, reason) {
    if (byUser.get(call.caller) !== call) return;
    clearTimeout(call.timer);
    byUser.delete(call.caller);
    byUser.delete(call.callee);
    io.to([accountRoom(call.caller), accountRoom(call.callee)]).emit("call:ended", { id: call.id, reason });
  }

  return function bind(socket) {
    const { userId } = socket.data;
    let starting = false;
    const current = (id) => {
      const call = byUser.get(userId);
      return call?.id === id ? call : undefined;
    };

    socket.on("call:start", async (body, respond) => {
      if (typeof respond !== "function") return;
      const { conversationId, mode } = body ?? {};
      if (starting || byUser.has(userId)) return respond({ error: "You already have a call." });
      if (!takeSocket(`call:${userId}`, 6, 60000).allowed) return respond({ error: "Too many call attempts. Try again shortly." });
      if (!mongoose.isObjectIdOrHexString(conversationId) || !["audio", "video"].includes(mode)) {
        return respond({ error: "Choose an existing direct conversation." });
      }
      starting = true;
      try {
        const conversation = await Conversation.findOne({
          _id: conversationId, kind: { $ne: "group" }, participants: { $all: [userId], $size: 2 },
        }).select("participants").lean();
        if (!conversation || await Group.exists({ conversation: conversationId })) {
          return respond({ error: "Calls are available in direct conversations." });
        }
        const callee = conversation.participants.map(String).find((id) => id !== userId);
        if (!callee || !io.sockets.adapter.rooms.get(accountRoom(callee))?.size) return respond({ error: "This person is offline." });
        if (!socket.connected || byUser.has(userId) || byUser.has(callee)) return respond({ error: "This person is busy." });

        const call = { id: randomUUID(), caller: userId, callee, callerSocket: socket.id, conversationId };
        byUser.set(userId, call);
        byUser.set(callee, call);
        call.timer = setTimeout(() => finish(call, "No answer"), 30000);
        call.timer.unref();
        respond({ id: call.id });
        io.to(accountRoom(callee)).emit("call:incoming", { id: call.id, conversationId, from: socket.data.username, mode });
      } catch (error) {
        console.error("Call setup failed:", error.message);
        respond({ error: "Could not start the call." });
      } finally {
        starting = false;
      }
    });

    socket.on("call:accept", (body, respond) => {
      const id = body?.id;
      if (typeof respond !== "function") return;
      const call = current(id);
      if (!call || call.callee !== userId || call.calleeSocket) return respond({ error: "This call is no longer ringing." });
      clearTimeout(call.timer);
      call.calleeSocket = socket.id;
      call.timer = setTimeout(() => finish(call, "Call time limit reached"), 2 * 60 * 60000);
      call.timer.unref();
      respond({ ok: true });
      socket.to(accountRoom(userId)).emit("call:ended", { id, reason: "Answered in another tab" });
      io.to(call.callerSocket).emit("call:accepted", { id });
    });

    socket.on("call:signal", (body) => {
      const { id, description, candidate } = body ?? {};
      const call = current(id);
      if (!call?.calleeSocket || ![call.callerSocket, call.calleeSocket].includes(socket.id)
        || !takeSocket(`signal:${userId}`, 180, 60000).allowed) return;
      const caller = socket.id === call.callerSocket;
      const peer = caller ? call.calleeSocket : call.callerSocket;
      if (description) {
        const type = caller ? "offer" : "answer";
        if (description.type !== type || typeof description.sdp !== "string" || description.sdp.length > 16000
          || (caller ? call.offered : !call.offered || call.answered)) return;
        if (caller) call.offered = true;
        else call.answered = true;
        io.to(peer).emit("call:signal", { id, description: { type, sdp: description.sdp } });
        return;
      }
      if (typeof candidate?.candidate === "string" && candidate.candidate.length <= 1800
        && (candidate.sdpMid == null || (typeof candidate.sdpMid === "string" && candidate.sdpMid.length <= 64))
        && (candidate.sdpMLineIndex == null || (Number.isInteger(candidate.sdpMLineIndex) && candidate.sdpMLineIndex >= 0 && candidate.sdpMLineIndex < 32))) {
        io.to(peer).emit("call:signal", { id, candidate: {
          candidate: candidate.candidate, sdpMid: candidate.sdpMid, sdpMLineIndex: candidate.sdpMLineIndex,
        } });
      }
    });

    socket.on("call:end", (body) => {
      const call = current(body?.id);
      if (!call || (socket.id !== call.callerSocket && socket.id !== call.calleeSocket
        && (call.calleeSocket || call.callee !== userId))) return;
      finish(call, call.calleeSocket ? "Call ended" : userId === call.callee ? "Call declined" : "Call canceled");
    });
    socket.on("disconnect", () => {
      const call = byUser.get(userId);
      if (call && [call.callerSocket, call.calleeSocket].includes(socket.id)) finish(call, "Connection lost");
    });
  };
}
