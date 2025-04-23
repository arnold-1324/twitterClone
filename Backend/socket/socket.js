import { Server } from "socket.io";
import http from "http";
import express from "express";
import Message from "../models/message.model.js";
import Conversation from "../models/conversation.model.js";

console.log('Socket.io server file loaded');

const app = express();
const server = http.createServer(app);

let ioInstance = null;

export function setupSocket(server) {
    console.log('Socket.io server file loaded');
    const io = new Server(server, {
        cors: {
            origin: "http://localhost:3000",
            methods: ["GET", "POST"],
        },
    });
    ioInstance = io;

    const userSocketMap = {};
    const typingUsers = {};

    io.userSocketMap = userSocketMap;

    io.on("connection", (socket) => {
        console.log("user connected", socket.id);
        const userId = socket.handshake.query.userId;

        if (userId && userId !== "undefined") {
            userSocketMap[userId] = socket.id;
            io.emit("getOnlineUsers", Object.keys(userSocketMap));
            console.log("Online users:", Object.keys(userSocketMap));
        }

        socket.on("joinRoom", (conversationId) => {
            if (conversationId) {
                socket.join(conversationId);
                console.log(`User ${userId} joined room ${conversationId}`);
            }
        });
        socket.on("leaveRoom", (conversationId) => {
            if (conversationId) {
                socket.leave(conversationId);
                console.log(`User ${userId} left room ${conversationId}`);
            }
        });

        socket.on("typing", ({ conversationId, isTyping }) => {
            if (!typingUsers[conversationId]) {
                typingUsers[conversationId] = [];
            }

            if (isTyping && !typingUsers[conversationId].includes(userId)) {
                typingUsers[conversationId].push(userId);
            } else if (!isTyping && typingUsers[conversationId].includes(userId)) {
                typingUsers[conversationId] = typingUsers[conversationId].filter((id) => id !== userId);
            }
            console.log(`Typing users in ${conversationId}:`, typingUsers[conversationId]);
            socket.to(conversationId).emit("typingStatus", { conversationId, typingUsers: typingUsers[conversationId] });
        });

        socket.on("markMessagesAsSeen", async ({ conversationId, userId }) => {
            try {
                await Message.updateMany({ conversationId: conversationId, seen: false }, { $set: { seen: true } });
                await Conversation.updateOne({ _id: conversationId }, { $set: { "lastMessage.seen": true } });
                io.to(userSocketMap[userId]).emit("messagesSeen", { conversationId });
            } catch (error) {
                console.log(error);
            }
        });

        socket.on("newMessage", ({ conversationId, message }) => {
            io.to(conversationId).emit("receiveMessage", message);
        });

        socket.on("disconnect", () => {
            console.log("user disconnected", socket.id);
            delete userSocketMap[userId];
            Object.keys(typingUsers).forEach((cid) => {
                typingUsers[cid] = typingUsers[cid].filter((id) => id !== userId);
            });
            io.emit("getOnlineUsers", Object.keys(userSocketMap));
            console.log("Online users after disconnect:", Object.keys(userSocketMap));
        });
    });
}

export function getIO() {
    return ioInstance;
}

export function getRecipientSocketId(recipientId) {
    return ioInstance?.userSocketMap?.[recipientId];
}

export { server, app };
