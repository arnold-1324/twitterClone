import { createCallHandler } from "./calls.js";
import { takeSocket } from "../lib/rateLimits.js";
import { Server } from "socket.io";
import cookieParser from "cookie-parser";
import { readAccessSession } from "../lib/utils/generateToken.js";
import mongoose from "mongoose";
import Conversation from "../models/conversation.model.js";
import Group from "../models/group.model.js";
import User from "../models/user.model.js";

let ioInstance;
const online = new Map();
const userRoom = (id) => `account:${id}`;

export async function belongsToConversation(conversationId, userId) {
  if (!mongoose.isObjectIdOrHexString(conversationId)) return false;
  const accountId = String(userId);
  const group = await Group.findOne({ conversation: conversationId }).select("members blocked").lean();
  if (group) {
    return group.members.some((id) => String(id) === accountId)
      && !group.blocked.some((id) => String(id) === accountId);
  }
  return Boolean(await Conversation.exists({ _id: conversationId, kind: { $ne: "group" }, participants: userId }));
}

export function setupSocket(server, origins) {
  const io = new Server(server, {
    maxHttpBufferSize: 32768,
    cors: { origin: origins, credentials: true },
    allowRequest: (request, callback) => {
      callback(null, (!request.headers.origin || origins.includes(request.headers.origin))
        && takeSocket(`handshake:${request.socket.remoteAddress}`, 120, 60000).allowed);
    },
  });
  ioInstance = io;
  const bindCalls = createCallHandler(io, userRoom);
  io.engine.use(cookieParser());

  io.use(async (socket, next) => {
    try {
      const claims = await readAccessSession(socket.request.cookies?.jwt);
      if (!claims) return next(new Error("Authentication required"));
      const { userId, sessionVersion, exp, sid } = claims;
      const user = mongoose.isObjectIdOrHexString(userId) && await User.findById(userId).select("username sessionVersion").lean();
      if (!user || (user.sessionVersion ?? 0) !== (sessionVersion ?? 0) || (online.get(String(userId))?.size ?? 0) >= 8) {
        return next(new Error("Authentication required"));
      }
      socket.data.userId = String(userId);
      socket.data.username = user.username;
      socket.data.exp = exp;
      socket.data.sid = sid;
      next();
    } catch {
      next(new Error("Authentication required"));
    }
  });

  let presenceTimer;
  const presenceChanges = new Set();
  function publishPresence(userId) {
    presenceChanges.add(userId);
    if (presenceTimer) return;
    presenceTimer = setTimeout(() => {
      presenceTimer = undefined;
      const onlineIds = [];
      const offlineIds = [];
      for (const id of presenceChanges) (online.has(id) ? onlineIds : offlineIds).push(id);
      presenceChanges.clear();
      io.emit("presenceChanged", { online: onlineIds, offline: offlineIds });
    }, 80);
    presenceTimer.unref();
  }

  io.on("connection", (socket) => {
    const { userId } = socket.data;
    const connections = online.get(userId) ?? new Set();
    if (connections.size >= 8) return socket.disconnect(true);
    connections.add(socket.id);
    online.set(userId, connections);
    socket.join([userRoom(userId), `session:${socket.data.sid}`]);
    bindCalls(socket);
    const expires = socket.data.exp ? setTimeout(() => socket.disconnect(true), Math.max(0, socket.data.exp * 1000 - Date.now())) : null;
    expires?.unref();
    socket.emit("getOnlineUsers", [...online.keys()]);
    if (connections.size === 1) publishPresence(userId);

    let activeRoom;
    let requestedRoom;
    let joinVersion = 0;
    let lastTyping = 0;
    let typingVersion = 0;

    function leaveActiveRoom() {
      if (!activeRoom) return;
      socket.to(activeRoom).emit("typingStatus", { conversationId: activeRoom, userId, isTyping: false });
      socket.leave(activeRoom);
      activeRoom = undefined;
      typingVersion++;
    }

    let checkingRoom = false;
    async function resolveRequestedRoom() {
      if (checkingRoom) return;
      checkingRoom = true;
      try {
        while (requestedRoom && socket.connected) {
          const conversationId = requestedRoom;
          const version = joinVersion;
          const allowed = await belongsToConversation(conversationId, userId);
          if (version !== joinVersion) continue;
          if (allowed && socket.connected) {
            await socket.join(conversationId);
            if (version === joinVersion) activeRoom = conversationId;
            else await socket.leave(conversationId);
          } else {
            requestedRoom = undefined;
          }
          if (version === joinVersion) break;
        }
      } catch (error) {
        requestedRoom = undefined;
        console.error("Could not join conversation:", error.message);
      } finally {
        checkingRoom = false;
      }
    }

    socket.on("joinRoom", (conversationId) => {
      if (typeof conversationId !== "string" || !mongoose.isObjectIdOrHexString(conversationId)
        || conversationId === requestedRoom || !takeSocket(`rooms:${userId}`, 45, 60000).allowed) return;
      joinVersion++;
      requestedRoom = conversationId;
      leaveActiveRoom();
      void resolveRequestedRoom();
    });

    socket.on("leaveRoom", (conversationId) => {
      if (conversationId !== requestedRoom) return;
      joinVersion++;
      requestedRoom = undefined;
      leaveActiveRoom();
    });

    socket.on("typing", async (payload) => {
      const { conversationId, isTyping } = payload ?? {};
      if (typeof isTyping !== "boolean" || !activeRoom || activeRoom !== conversationId || !socket.rooms.has(conversationId)) return;
      if (isTyping && Date.now() - lastTyping < 750) return;
      const version = ++typingVersion;
      if (!isTyping) {
        socket.to(conversationId).emit("typingStatus", { conversationId, userId, isTyping });
        return;
      }
      lastTyping = Date.now();
      try {
        if (await belongsToConversation(conversationId, userId) && activeRoom === conversationId
          && version === typingVersion && socket.connected) {
          socket.to(conversationId).emit("typingStatus", { conversationId, userId, isTyping });
        }
      } catch (error) {
        console.error("Could not update typing status:", error.message);
      }
    });

    socket.on("disconnecting", leaveActiveRoom);
    socket.on("disconnect", () => {
      clearTimeout(expires);
      connections.delete(socket.id);
      if (connections.size === 0) {
        online.delete(userId);
        publishPresence(userId);
      }
    });
  });
}

export function getIO() {
  return ioInstance;
}

export function getRecipientRoom(recipientId) {
  return recipientId ? userRoom(String(recipientId)) : undefined;
}
