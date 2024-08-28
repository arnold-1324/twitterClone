import { s3, generateFileName } from "../lib/utils/uploader.js";
import Conversation from "../models/conversation.model.js";
import Message from "../models/message.model.js";
import { PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { getRecipientSocketId, io } from "../socket/socket.js";


export const sendMessage = async (req, res) => {
    const { recipientId, message } = req.body;
    const senderId = req.user._id;

    try {
        let fileUrl = "";
        if (req.file) {
            const params = {
                Bucket: process.env.BUCKET_NAME,
                Key: generateFileName(),
                Body: req.file.buffer,
                ContentType: req.file.mimetype,
            };
            const uploadResult = await s3.send(new PutObjectCommand(params));
            fileUrl = uploadResult.Location || ""; 
        }

        let conversation = await Conversation.findOneAndUpdate(
            { participants: { $all: [senderId, recipientId] } },
            { $set: { lastMessage: { text: message, sender: senderId } } },
            { new: true, upsert: true }
        );

        const newMessage = new Message({
            conversationId: conversation._id,
            sender: senderId,
            text: message,
            img: fileUrl || "",
            video: fileUrl || ""
        });

        await newMessage.save();

        const recipientSocketId = getRecipientSocketId(recipientId);
        if (recipientSocketId) {
            io.to(recipientSocketId).emit("newMessage", newMessage);
            io.to(recipientSocketId).emit("stopTyping", { conversationId: conversation._id });
        }

        res.status(201).json(newMessage);
    } catch (error) {
        res.status(500).json({ error: error.message });
        console.log("Error in sendMessage:", error.message);
    }
};


export const getMessages = async (req, res) => {
    const { otherUserId } = req.params;
    const userId = req.user._id;

    try {
        const conversation = await Conversation.findOne({ participants: { $all: [userId, otherUserId] } });
        if (!conversation) {
            return res.status(404).json({ error: "Conversation not found" });
        }

        const { page = 1, limit = 20 } = req.query; 

        const messages = await Message.find({ conversationId: conversation._id })
                                      .sort({ createdAt: 1 })
                                      .skip((page - 1) * limit)
                                      .limit(limit)
                                      .populate({
                                          path: 'sender',
                                          select: 'username profilePic'
                                      });

        for (const message of messages) {
            if (message.sender.profilePic) {
                const profilePicParams = {
                    Bucket: process.env.BUCKET_NAME,
                    Key: message.sender.profilePic,
                };
                const profilePicCommand = new GetObjectCommand(profilePicParams);
                message.sender.profilePic = await getSignedUrl(s3, profilePicCommand, { expiresIn: 3600 });
            }

            if (message.img) {
                const imgParams = {
                    Bucket: process.env.BUCKET_NAME,
                    Key: message.img,
                };
                const imgCommand = new GetObjectCommand(imgParams);
                message.img = await getSignedUrl(s3, imgCommand, { expiresIn: 3600 });
            }
        }

        await Message.updateMany(
            {
                conversationId: conversation._id,
                sender: { $ne: userId },
                seen: false
            },
            { $set: { seen: true } }
        );

        const recipientSocketId = getRecipientSocketId(otherUserId);
        if (recipientSocketId) {
            io.to(recipientSocketId).emit("messagesSeen", { conversationId: conversation._id });
        }

        res.status(200).json(messages);
    } catch (error) {
        res.status(500).json({ error: error.message });
        console.log("Error in getMessages:", error.message);
    }
};

export const getConversation = async (req, res) => {
    const userId = req.user._id;

    try {
        const conversations = await Conversation.find({ participants: userId })
            .populate({
                path: "participants",
                select: "username profilePic",
                match: { _id: { $ne: userId } }
            })
            .sort({ updatedAt: -1 });

        for (const conversation of conversations) {
            const otherParticipant = conversation.participants.find(p => p._id.toString() !== userId.toString());

            if (otherParticipant?.profilePic) {
                const profilePicParams = {
                    Bucket: process.env.BUCKET_NAME,
                    Key: otherParticipant.profilePic,
                };
                const profilePicCommand = new GetObjectCommand(profilePicParams);
                otherParticipant.profilePic = await getSignedUrl(s3, profilePicCommand, { expiresIn: 3600 });
            }

            conversation.lastMessage = conversation.lastMessage || {};
        }

        res.status(200).json(conversations);
    } catch (error) {
        res.status(500).json({ error: error.message });
        console.log("Error in getConversation:", error.message);
    }
};

export const editMessage = async (req, res) => {
    const { messageId, newText } = req.body;
    const userId = req.user._id;

    try {
        const message = await Message.findOneAndUpdate(
            { _id: messageId, sender: userId },
            { text: newText },
            { new: true }
        );

        if (!message) {
            return res.status(404).json({ error: "Message not found or not authorized" });
        }

        io.to(getRecipientSocketId(message.recipient)).emit("messageEdited", message);

        res.status(200).json(message);
    } catch (error) {
        res.status(500).json({ error: error.message });
        console.log("Error in editMessage:", error.message);
    }
};


export const replyToMessage = async (req, res) => {
    const { recipientId, messageId, replyText } = req.body;
    const senderId = req.user._id;

    try {
        const parentMessage = await Message.findById(messageId);
        if (!parentMessage) {
            return res.status(404).json({ error: "Parent message not found" });
        }

        const conversation = await Conversation.findOneAndUpdate(
            { participants: { $all: [senderId, recipientId] } },
            { $set: { lastMessage: { text: replyText, sender: senderId } } },
            { new: true, upsert: true }
        );

        const replyMessage = new Message({
            conversationId: conversation._id,
            sender: senderId,
            text: replyText,
            replyTo: parentMessage._id
        });

        await replyMessage.save();

        const recipientSocketId = getRecipientSocketId(recipientId);
        if (recipientSocketId) {
            io.to(recipientSocketId).emit("newReply", replyMessage);
        }

        res.status(201).json(replyMessage);
    } catch (error) {
        res.status(500).json({ error: error.message });
        console.log("Error in replyToMessage:", error.message);
    }
};


export const deleteMessage = async (req, res) => {
    const { messageId } = req.params;
    const userId = req.user._id;

    try {
        const message = await Message.findOneAndUpdate(
            { _id: messageId, sender: userId },
            { deletedFor: userId },
            { new: true }
        );

        if (!message) {
            return res.status(404).json({ error: "Message not found or not authorized" });
        }

        io.to(getRecipientSocketId(message.recipient)).emit("messageDeleted", { messageId });

        res.status(200).json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
        console.log("Error in deleteMessage:", error.message);
    }
};
