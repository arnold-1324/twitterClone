import { s3, generateFileName } from "../lib/utils/uploader.js";
import Conversation from "../models/conversation.model.js";
import Message from "../models/message.model.js";
import { ObjectId } from "mongoose";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getRecipientSocketId, io } from "../socket/socket.js";
import {encrypt,decrypt } from "../lib/utils/Msg_encryption/encrypt.js";



export const sendMessage = async (req, res) => {
    const { recipientId, message } = req.body;
    const senderId = req.user._id;
  
    try {
      // Ensure recipientId and senderId are valid ObjectId strings
      if (!mongoose.Types.ObjectId.isValid(recipientId) || !mongoose.Types.ObjectId.isValid(senderId)) {
        return res.status(400).json({ error: "Invalid sender or recipient ID" });
      }
  
      let img = "";
      let video = "";
  
      // Handle file upload if present
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
        const publicUrl = `https://${process.env.BUCKET_NAME}.s3.${process.env.REGION}.amazonaws.com/${fileUrl}`;
  
        if (req.file.mimetype.startsWith("image/")) {
          img = publicUrl;
        } else if (req.file.mimetype.startsWith("video/")) {
          video = publicUrl;
        }
      }
  
      // Encrypt message
      const encryptedMessage = encrypt(message);
  
      // Find or create conversation
      let conversation = await Conversation.findOneAndUpdate(
        {
          participants: {
            $size: 2,
            $all: [new mongoose.Types.ObjectId(senderId), new mongoose.Types.ObjectId(recipientId)],
          },
        },
        {
          $set: {
            lastMessage: {
              text: encryptedMessage.encryptedData,
              iv: encryptedMessage.iv,
              sender: senderId,
            },
          },
        },
        { new: true }
      );
  
      if (!conversation) {
        conversation = new Conversation({
          participants: [new mongoose.Types.ObjectId(senderId), new mongoose.Types.ObjectId(recipientId)],
          lastMessage: { text: encryptedMessage.encryptedData, iv: encryptedMessage.iv, sender: senderId },
        });
        await conversation.save();
      }
  
      // Create a new message
      const newMessage = new Message({
        conversationId: conversation._id,
        sender: senderId,
        text: encryptedMessage.encryptedData,
        img,
        video,
        iv: encryptedMessage.iv,
      });
  
      await newMessage.save();
  
      // Real-time handling via socket (if applicable)
      const recipientSocketId = getRecipientSocketId(recipientId);
      if (recipientSocketId) {
        io.to(recipientSocketId).emit("newMessage", newMessage);
        io.to(recipientSocketId).emit("stopTyping", { conversationId: conversation._id });
      }
  
      // Decrypt the message to send in response
      const decryptedMessage = decrypt({
        iv: newMessage.iv,
        encryptedData: newMessage.text,
      });
  
      const responseMessage = {
        ...newMessage._doc,
        text: decryptedMessage,
        iv: undefined, 
      };
  
      res.status(201).json(responseMessage);
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

       
        const decryptedMessages = messages.map(msg => {
            const decryptedText = decrypt({ iv: msg.iv, encryptedData: msg.text });
            return {
                ...msg._doc,
                text: decryptedText ,
                iv:undefined
            };
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
        

        res.status(200).json(decryptedMessages);
    } catch (error) {
        res.status(500).json({ error: error.message });
        console.log("Error in getMessages:", error.message);
    }
};


export const getConversation = async (req, res) => {
    try {
     // const { userId } = req.params;
      let  Cuserid  = req.user._id.toString();

    //  console.log("user id params  "+typeof(userId) + " "+ userId );
      console.log("user id cookies  "+typeof(Cuserid) + " " +Cuserid);  

      const conversations = await Conversation.find({
        participants: Cuserid,
      })
        .populate({
          path: 'participants', 
          select: 'username profileImg', 
        })
        .populate({
          path: 'lastMessage.sender', 
          select: 'username profileImg', 
        })
        .sort({ updatedAt: -1 }); 

      res.status(200).json(conversations);
    } catch (error) {
      console.error("Error in getConversation:", error.message ,typeof(userId));
      res.status(500).json({ error: error.message });
    }
};



export const editMessage = async (req, res) => {
    const { messageId, newText } = req.body;
    const userId = req.user._id;

    try {
        const encryptedMessage= encrypt(newText);

        const message = await Message.findOneAndUpdate(
            { _id: messageId, sender: userId },
            { text: encryptedMessage.encryptedData, edited: true, iv: encryptedMessage.iv }, 
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

        
         const recipientSocketIds = getRecipientSocketIds(conversation.participants);
         recipientSocketIds.forEach(socketId => {
             io.to(socketId).emit("messageEdited", message);
         });

        const decryptMessage = decrypt({ iv: message.iv, encryptedData: message.text });
    
        const responsMessage ={
          ...message._doc,
          text:decryptMessage,
          iv:undefined
        };


        res.status(200).json(responsMessage);
    } catch (error) {
        res.status(500).json({ error: error.message });
        console.log("Error in editMessage:", error.message);
    }
};


export const replyToMessage = async (req, res) => {
    const { recipientId, messageId, replyText } = req.body;
    const senderId = req.user._id;

    try {
        
        const encryptedMessage=encrypt(replyText);

        const parentMessage = await Message.findById(messageId).populate('sender', 'username');
        if (!parentMessage) {
            return res.status(404).json({ error: "Parent message not found" });
        }

        
        const conversation = await Conversation.findOneAndUpdate(
            { participants: { $all: [senderId, recipientId] } },
            { text: encryptedMessage.encryptedData, edited: true, iv: encryptedMessage.iv }, 
            { new: true, upsert: true }
        );


       
        const replyMessage = new Message({
            conversationId: conversation._id,
            sender: senderId,
            text: encryptedMessage.encryptedData,
            iv:encryptedMessage.iv,
            replyTo: parentMessage._id
        });
        
        
        const savedReplyMessage = await replyMessage.save();
        const populatedReplyMessage = await savedReplyMessage.populate('sender', 'username profileImg');
        
        const decryptParentMessage = decrypt({ iv: parentMessage.iv, encryptedData: parentMessage.text });
    
        const decrytreplyMessage = decrypt({iv: populatedReplyMessage.iv, encryptedData: populatedReplyMessage.text})
      
        
        res.status(201).json({
            messageId: populatedReplyMessage._id,
            conversationId: populatedReplyMessage.conversationId,
            sender: {
                id: populatedReplyMessage.sender._id,
                username: populatedReplyMessage.sender.username,
                profileImg: populatedReplyMessage.sender.profileImg 
            },
            text: decrytreplyMessage,
            type: "text",
            replyTo: {
                messageId: parentMessage._id,
                text: decryptParentMessage,
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


export const reactTomsg = async (req,res)=>{
    try{
        const {messageId,reactions} = req.body;
        const userId = req.user._id;

        const message = await Message.findByIdAndUpdate(
            { _id: messageId },
            { $push: { reactions: { user: userId, reaction: reactions } } },
            { new: true }
        ).populate('sender', 'username profileImg');

        if (!message) {
            return res.status(404).json({ error: "Message not found" });
        }
        res.status(200).json(message);
    } catch(error){
        res.status(500).json({ error: error.message });
        console.log("Error in reactToMsg:", error.message);
    }
}
