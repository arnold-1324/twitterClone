import { s3, generateFileName } from "../lib/utils/uploader.js";
import Conversation from "../models/conversation.model.js";
import Message from "../models/message.model.js";
import mongoose from "mongoose";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getRecipientSocketId, io } from "../socket/socket.js";


export const sendMessage = async (req, res) => {
    const { recipientId, message } = req.body;
    const senderId = req.user._id;

    try {
        let img = "";
        let video = "";

        
        if (req.file) {
            const fileUrl = generateFileName();
            const params = {
                Bucket: process.env.BUCKET_NAME,
                Key: fileUrl,
                Body: req.file.buffer,
                ContentType: req.file.mimetype,
            };

            
            const command = new PutObjectCommand(params);
            await s3.send(command);
            console.log("Uploaded new file:", fileUrl);
            console.log("MIME Type:", req.file.mimetype);
            const publicUrl = `https://${process.env.BUCKET_NAME}.s3.${process.env.REGION}.amazonaws.com/${fileUrl}`;

            
            if (req.file.mimetype.startsWith("image/")) {
                img = publicUrl;
            } else if (req.file.mimetype.startsWith("video/")) {
                video = publicUrl;
            }
        }

        
        let conversation = await Conversation.findOneAndUpdate(
            { participants: { $size: 2, $all: [senderId, recipientId] } },
            { $set: { lastMessage: { text: message, sender: senderId } } },
            { new: true }
          );

          if (!conversation) {
            conversation = new Conversation({
                participants: [senderId, recipientId],
                lastMessage: { text: message, sender: senderId },
            });
            await conversation.save();
        }
        
        const newMessage = new Message({
            conversationId: conversation._id,
            sender: senderId,
            text: message,
            img,   
            video, 
        });

        await newMessage.save();

        if (conversation.lastMessage.sender.toString()!== senderId) {
            conversation.lastMessage.seen = true;
            await conversation.save();
        }
        const recipientSocketId = getRecipientSocketId(recipientId);
        if (recipientSocketId) {
            io.to(recipientSocketId).emit("newMessage", newMessage);
            io.to(recipientSocketId).emit("stopTyping", { conversationId: conversation._id });
        }

        res.status(201).json(newMessage);
    } catch (error) {
        console.error("Error in sendMessage:", error.message);
        res.status(500).json({ error: error.message });
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
                                          select: 'username profileImg'
                                      });

       

          

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

// export const getConversation = async (req, res) => {
//     try {
//         const userId = mongoose.Types.ObjectId(req.user._id); 
//         console.log("User ID:", userId);

//         const conversations = await Conversation.find({ participants: userId })
//             .populate({
//                 path: "participants",
//                 select: "username profileImg",
//                 match: { _id: { $ne: userId } }
//             })
//             .sort({ updatedAt: -1 });

//         console.log("Conversations:", conversations);

//         for (const conversation of conversations) {
//             const otherParticipant = conversation.participants.find(p => p._id.toString() !== userId.toString());

            
//             conversation.lastMessage = conversation.lastMessage || {};
//         }

//         res.status(200).json(conversations);
//     } catch (error) {
//         console.log("Error in getConversation:", error.message);
//         res.status(500).json({ error: error.message });
//     }
// };

export const getConversation = async (req, res) => {
    try {
        const userId = req.user._id;
        console.log("User ID:", userId.toString());
  
        const objectIdUser = mongoose.Types.ObjectId(userId);
        
        const conversations = await Conversation.find({ participants: objectIdUser })
            .populate({
                path: "participants",
                select: "username profileImg",
            })
            .populate({
                path: "lastMessage.sender", 
                select: "username profileImg",
            });

        console.log("Fetched Conversations:", conversations);

        
        conversations.forEach((conversation) => {
            conversation.participants = conversation.participants.filter(
                (participant) => participant._id.toString() !== userId.toString()
            );
        });

        
        res.status(200).json(conversations);
    } catch (error) {
        console.error("Error in getConversation:", error.message, userId.toString());
        res.status(500).json({ error: error.message });
    }
};


export const editMessage = async (req, res) => {
    const { messageId, newText } = req.body;
    const userId = req.user._id;

    try {
        
        const message = await Message.findOneAndUpdate(
            { _id: messageId, sender: userId },
            { text: newText, edited: true }, 
            { new: true }
        )
        .populate('sender', 'username profileImg')  
        .populate('replyTo', 'text')  
        .populate('reactions.user', 'username');  

        if (!message) {
            return res.status(404).json({ error: "Message not found or not authorized" });
        }

        
        const conversation = await Conversation.findById(message.conversationId)
            .populate('participants', 'username');  

        
        // const recipientSocketIds = getRecipientSocketIds(conversation.participants);
        // recipientSocketIds.forEach(socketId => {
        //     io.to(socketId).emit("messageEdited", message);
        // });

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
        
        const parentMessage = await Message.findById(messageId).populate('sender', 'username');
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

        
        const savedReplyMessage = await replyMessage.save();
        const populatedReplyMessage = await savedReplyMessage.populate('sender', 'username profileImg');

        
        res.status(201).json({
            messageId: populatedReplyMessage._id,
            conversationId: populatedReplyMessage.conversationId,
            sender: {
                id: populatedReplyMessage.sender._id,
                name: populatedReplyMessage.sender.username,
                avatar: populatedReplyMessage.sender.profileImg 
            },
            text: populatedReplyMessage.text,
            type: "text", 
            replyTo: {
                messageId: parentMessage._id,
                text: parentMessage.text,
                sender: {
                    id: parentMessage.sender._id,
                    name: parentMessage.sender.name
                }
            },
            status: {
                seen: false,
                edited: false,
                deletedFor: []
            },
            reactions: [],
            createdAt: populatedReplyMessage.createdAt,
            updatedAt: populatedReplyMessage.updatedAt
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
        console.log("Error in replyToMessage:", error.message);
    }
};


export const deleteMessage = async (req, res) => {
    const { messageId } = req.body;
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
