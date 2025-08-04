import { Server } from "socket.io";
import http from "http";
import express from "express";
import Message from "../models/message.model.js";
import Conversation from "../models/conversation.model.js";

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
    cors: {
        origin: [
            "http://localhost:3000",
            "https://twitterclone-production-40ce.up.railway.app/"
        ],
        methods: ["GET", "POST"],
    },
});

let ioInstance = null;

export function setupSocket(server) {
    
    const io = new Server(server, {
        cors: {
            origin: "http://localhost:3000",
            methods: ["GET", "POST"],
        },
    });
    ioInstance = io;

    const userSocketMap = {};
    const typingUsers = {};
    const groupTypingUsers = {};

    io.userSocketMap = userSocketMap;

    io.on("connection", (socket) => {
       
        const userId = socket.handshake.query.userId;

        if (userId && userId !== "undefined") {
            userSocketMap[userId] = socket.id;
            io.emit("getOnlineUsers", Object.keys(userSocketMap));
            
        }

        socket.on("setUserId", (userId) => {
            if (userId && userId !== "undefined") {
                userSocketMap[userId] = socket.id;
                io.emit("getOnlineUsers", Object.keys(userSocketMap));
            }
        });

        socket.on("joinRoom", (conversationId) => {
            if (conversationId) {
                socket.join(conversationId);
              
            }
        });
        socket.on("leaveRoom", (conversationId) => {
            if (conversationId) {
                socket.leave(conversationId);
                
            }
        });

        socket.on("typing", ({ conversationId, isTyping, isGroup = false }) => {
            if (isGroup) {
                // Handle group typing
                if (!groupTypingUsers[conversationId]) {
                    groupTypingUsers[conversationId] = [];
                }

                if (isTyping && !groupTypingUsers[conversationId].includes(userId)) {
                    groupTypingUsers[conversationId].push(userId);
                } else if (!isTyping && groupTypingUsers[conversationId].includes(userId)) {
                    groupTypingUsers[conversationId] = groupTypingUsers[conversationId].filter((id) => id !== userId);
                }
               
                socket.to(conversationId).emit("typingStatus", { 
                    conversationId, 
                    typingUsers: groupTypingUsers[conversationId],
                    isGroup: true 
                });
            } else {
                // Handle individual chat typing
                if (!typingUsers[conversationId]) {
                    typingUsers[conversationId] = [];
                }

                if (isTyping && !typingUsers[conversationId].includes(userId)) {
                    typingUsers[conversationId].push(userId);
                } else if (!isTyping && typingUsers[conversationId].includes(userId)) {
                    typingUsers[conversationId] = typingUsers[conversationId].filter((id) => id !== userId);
                }
               
                socket.to(conversationId).emit("typingStatus", { 
                    conversationId, 
                    typingUsers: typingUsers[conversationId],
                    isGroup: false 
                });
            }
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

        socket.on("newGroupMessage", ({ conversationId, message, groupId }) => {
            io.to(conversationId).emit("newGroupMessage", { message, groupId, conversationId });
        });

        socket.on("reconnect", () => {
            if (userId && userId !== "undefined") {
                userSocketMap[userId] = socket.id;
                io.emit("getOnlineUsers", Object.keys(userSocketMap));
            }
        });

        socket.on("disconnect", () => {
          
            delete userSocketMap[userId];
            // Remove user from all typing lists
            Object.keys(typingUsers).forEach((cid) => {
                typingUsers[cid] = typingUsers[cid].filter((id) => id !== userId);
            });
            Object.keys(groupTypingUsers).forEach((cid) => {
                groupTypingUsers[cid] = groupTypingUsers[cid].filter((id) => id !== userId);
            });
            io.emit("getOnlineUsers", Object.keys(userSocketMap));
            
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
