import { Server } from "socket.io";
import http from "http";
import express from "express";
import Message from "../models/message.model.js";
import Conversation from "../models/conversation.model.js";

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "http://127.0.0.1:5000",
        methods: ["GET", "POST"],
    },
});

const userSocketMap = {}; 
const typingUsers = {};

export const getRecipientSocketId = (recipientId) => {
    return userSocketMap[recipientId];
};

io.on("connection", (socket) => {
    console.log("user connected", socket.id);
    const userId = socket.handshake.query.userId;

    if (userId !== "undefined") {
        userSocketMap[userId] = socket.id;
        io.emit("getOnlineUsers", Object.keys(userSocketMap));
    }


    socket.on("typing", ({ conversationId, isTyping }) => {
        if (!typingUsers[conversationId]) {
            typingUsers[conversationId] = [];
        }

        if (isTyping && !typingUsers[conversationId].includes(userId)) {
            typingUsers[conversationId].push(userId);
        } else if (!isTyping && typingUsers[conversationId].includes(userId)) {
            typingUsers[conversationId] = typingUsers[conversationId].filter((id) => id !== userId);
        }

        socket.broadcast.to(conversationId).emit("typingStatus", { conversationId, typingUsers: typingUsers[conversationId] });
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
        console.log("user disconnected");
        delete userSocketMap[userId];
        io.emit("getOnlineUsers", Object.keys(userSocketMap));
    });
});

export { io, server, app };
