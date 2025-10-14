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
            "https://frontend-gamma-opal-34.vercel.app/"
        ],
        methods: ["GET", "POST"],
    },
});

let ioInstance = null;

export function setupSocket(server) {
    
    const io = new Server(server, {
        cors: {
            origin: "https://frontend-gamma-opal-34.vercel.app/",
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


                // ✅ Create poll in a group
        socket.on("createPoll", async ({ conversationId, poll }) => {
            try {
                const newPoll = await Message.create({
                    conversationId,
                    sender: poll.sender,
                    type: "poll",
                    poll: {
                        question: poll.question,
                        options: poll.options.map((opt) => ({ optionText: opt })),
                        multiSelect: poll.multiSelect || false,
                        expiresAt: poll.expiresAt || null,
                    },
                });

                // Broadcast to group members
                io.to(conversationId).emit("pollCreated", newPoll);
            } catch (error) {
                console.error("Error creating poll via socket:", error);
                socket.emit("pollError", { message: "Failed to create poll" });
            }
        });

        // ✅ Vote on a poll
        socket.on("votePoll", async ({ messageId, userId, selectedOptions }) => {
            try {
                const pollMessage = await Message.findById(messageId);
                if (!pollMessage || pollMessage.type !== "poll") return;

                if (pollMessage.poll.closed) {
                    socket.emit("pollError", { message: "Poll is closed" });
                    return;
                }

                if (pollMessage.poll.expiresAt && new Date() > pollMessage.poll.expiresAt) {
                    pollMessage.poll.closed = true;
                    await pollMessage.save();
                    io.to(pollMessage.conversationId.toString()).emit("pollClosed", pollMessage);
                    return;
                }

                // Clear previous votes
                pollMessage.poll.options.forEach(opt => {
                    opt.votes = opt.votes.filter(id => id.toString() !== userId);
                });

                // Add new votes
                if (pollMessage.poll.multiSelect) {
                    selectedOptions.forEach(index => {
                        if (pollMessage.poll.options[index]) {
                            pollMessage.poll.options[index].votes.push(userId);
                        }
                    });
                } else {
                    if (selectedOptions.length > 1) return;
                    const index = selectedOptions[0];
                    if (pollMessage.poll.options[index]) {
                        pollMessage.poll.options[index].votes.push(userId);
                    }
                }

                // Update total votes
                pollMessage.poll.totalVotes = pollMessage.poll.options.reduce(
                    (sum, opt) => sum + opt.votes.length,
                    0
                );

                await pollMessage.save();

                // ✅ Notify all group members
                io.to(pollMessage.conversationId.toString()).emit("pollVoted", pollMessage);
            } catch (error) {
                console.error("Error voting via socket:", error);
                socket.emit("pollError", { message: "Failed to record vote" });
            }
        });

        // ✅ Close a poll manually (by admin or creator)
        socket.on("closePoll", async ({ messageId }) => {
            try {
                const pollMessage = await Message.findById(messageId);
                if (!pollMessage || pollMessage.type !== "poll") return;

                pollMessage.poll.closed = true;
                await pollMessage.save();

                io.to(pollMessage.conversationId.toString()).emit("pollClosed", pollMessage);
            } catch (error) {
                console.error("Error closing poll via socket:", error);
                socket.emit("pollError", { message: "Failed to close poll" });
            }
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
