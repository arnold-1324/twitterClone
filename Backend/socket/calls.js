import { randomUUID } from "node:crypto";
import mongoose from "mongoose";
import Conversation from "../models/conversation.model.js";
import Group from "../models/group.model.js";
import { takeSocket } from "../lib/rateLimits.js";
import { mediaUrl } from "../lib/mediaStore.js";

export function createCallHandler(io, accountRoom, saveCallHistory) {
  const byUser = new Map();

  async function record(call, outcome) {
    const duration = call.connectedAt === undefined ? undefined
      : Math.min(7200, Math.floor((performance.now() - call.connectedAt) / 1000));
    try {
      const message = await saveCallHistory(call, outcome, new Date(), duration);
      io.to([accountRoom(call.caller), accountRoom(call.callee)]).emit("newMessage", message);
    } catch (error) {
      console.error("Could not save call history:", error.message);
    }
  }

  function finish(call, outcome, reason) {
    if (byUser.get(call.caller) !== call) return;
    clearTimeout(call.timer);
    byUser.delete(call.caller);
    byUser.delete(call.callee);
    io.to([accountRoom(call.caller), accountRoom(call.callee)]).emit("call:ended", { id: call.id, reason });
    void record(call, outcome);
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
        if (!callee) return respond({ error: "Calls are available in direct conversations." });
        const profileImg = await mediaUrl(socket.data.profileImg).catch(() => "");
        if (!socket.connected || byUser.has(userId)) return respond({ error: "You already have a call." });

        const call = {
          id: randomUUID(), historyId: new mongoose.Types.ObjectId(), caller: userId, callee,
          callerSocket: socket.id, conversationId: String(conversation._id), mode,
          callerProfile: { _id: userId, username: socket.data.username, profileImg },
          connectedPeers: new Set(),
        };
        if (!io.sockets.adapter.rooms.get(accountRoom(callee))?.size) {
          void record(call, "offline");
          return respond({ error: "This person is offline." });
        }
        if (byUser.has(callee)) {
          void record(call, "busy");
          return respond({ error: "This person is busy." });
        }
        byUser.set(userId, call);
        byUser.set(callee, call);
        call.timer = setTimeout(() => finish(call, "missed", "No answer"), 30000);
        call.timer.unref();
        respond({ id: call.id });
        io.to(accountRoom(callee)).emit("call:incoming", {
          id: call.id, conversationId: call.conversationId, from: socket.data.username, profileImg, mode,
        });
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
      call.timer = setTimeout(() => {
        finish(call, call.connectedAt === undefined ? "failed" : "completed", "Call time limit reached");
      }, 2 * 60 * 60000);
      call.timer.unref();
      respond({ ok: true });
      socket.to(accountRoom(userId)).emit("call:ended", { id, reason: "Answered in another tab" });
      io.to(call.callerSocket).emit("call:accepted", { id });
    });

    socket.on("call:connected", (body) => {
      const call = current(body?.id);
      if (!call?.calleeSocket || ![call.callerSocket, call.calleeSocket].includes(socket.id)
        || call.connectedAt !== undefined) return;
      call.connectedPeers.add(socket.id);
      if (call.connectedPeers.size !== 2) return;
      call.connectedAt = performance.now();
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
      if (call.connectedAt !== undefined) {
        if (body?.connectionFailed === true) finish(call, "interrupted", "Connection lost");
        else finish(call, "completed", "Call ended");
      } else if (call.calleeSocket || body?.connectionFailed === true) {
        finish(call, "failed", "Could not establish a media connection");
      } else if (userId === call.callee) {
        finish(call, "declined", "Call declined");
      } else {
        finish(call, "canceled", "Call canceled");
      }
    });
    socket.on("disconnect", () => {
      const call = byUser.get(userId);
      if (call && [call.callerSocket, call.calleeSocket].includes(socket.id)) {
        finish(call, call.connectedAt === undefined ? "failed" : "interrupted", "Connection lost");
      }
    });
  };
}
