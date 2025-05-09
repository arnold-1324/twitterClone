import moment from "moment";  
import { s3, generateFileName } from "../lib/utils/uploader.js";
import Conversation from "../models/conversation.model.js";
import Message from "../models/message.model.js";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getIO, getRecipientSocketId } from "../socket/socket.js";
import { encrypt, decrypt } from "../lib/utils/Msg_encryption/encrypt.js";


export const sendMessage = async (req, res) => {
  const { recipientId, message } = req.body;
  const senderId = req.user._id;

  let img = "";
  let video = "";
  let audio="";
  try {
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
      }else if (req.file.mimetype.startsWith("audio/")) {
        audio = publicUrl;
    }
  }

    
    // Encrypt the message text
    const encryptedMessage = encrypt(message);

    // Find or create a conversation
    let conversation = await Conversation.findOneAndUpdate(
      {
        participants: {
          $size: 2,
          $all: [senderId, recipientId],
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

    // If no conversation exists, create a new one
    if (!conversation) {
      conversation = new Conversation({
        participants: [senderId, recipientId],
        lastMessage: {
          text: encryptedMessage.encryptedData,
          iv: encryptedMessage.iv,
          sender: senderId,
        },
      });
      await conversation.save();
    }

    // Create a new message document including media
    const newMessage = new Message({
      conversationId: conversation._id,
      sender: senderId,
      text: encryptedMessage.encryptedData,
      img: img,  // Save the image URL here
      video: video,
      audio:audio,  // Save the video URL here
      iv: encryptedMessage.iv,
    });

    // Log message data before saving
 

    await newMessage.save();

    console.log(newMessage);

    // Notify recipient via socket (if online)
    const io = getIO();
    const recipientSocketId = getRecipientSocketId(recipientId);
    if (recipientSocketId) {
      io.to(recipientSocketId).emit("newMessage", newMessage);
      io.to(recipientSocketId).emit("stopTyping", { conversationId: conversation._id });
    }

    // Decrypt the message to send back in response
    const decryptedMessage = decrypt({
      iv: newMessage.iv,
      encryptedData: newMessage.text,
    });

    const responseMessage = {
      ...newMessage._doc,
      text: decryptedMessage,  // Decrypted message text
      iv: undefined,  // Remove the iv from the response
    };

    res.status(201).json(responseMessage);  // Send the message back with media URL

  } catch (error) {
    console.error("Error in sendMessage:", error.message);
    res.status(500).json({ error: error.message });
  }
};





export const getMessages = async (req, res) => {
  const { otherUserId } = req.params;
  const userId = req.user._id;

  try {
      const conversation = await Conversation.findOne({ 
          participants: { $all: [userId, otherUserId] } 
      }).lean();

      if (!conversation) {
          return res.status(404).json({ error: "Conversation not found" });
      }


      const messages = await Message.find({ conversationId: conversation._id })

      .sort({ createdAt: 1 })
      .populate({ 
          path: 'sender', 
          select: 'username profileImg' 
      })
      .populate({ 
          path: 'replyTo', 
          select: 'text iv sender video img audio', 
          populate: { path: 'sender', select: 'username profileImg' } 
      })
      .populate({
        path: 'postReference',
        select: 'postedBy images',
        populate: { path: 'postedBy', select: 'username profileImg' }
      })
      .populate({
        path: 'reactions',
        select: 'user type',
        populate: { path: 'user', select: 'username profileImg' }
      })
      .lean();
    

      const unseenMessages = messages.filter(msg => !msg.seen && msg.sender._id.toString() !== userId);
      if (unseenMessages.length > 0) {
          await Message.updateMany(
              { _id: { $in: unseenMessages.map(msg => msg._id) } },
              { seen: true }
          );
      }

      if (conversation.lastMessage?.sender.toString() !== userId) {
          await Conversation.updateOne(
              { _id: conversation._id },
              { 'lastMessage.seen': true }
          );
      }

      const decryptSafely = ({ iv, encryptedData }) => {
        try {
            return decrypt({ iv, encryptedData });  // Try to decrypt
        } catch (error) {
            return 'Bad message';  // Return default message on failure
        }
    };
    
    const decryptedMessages = messages.map(msg => ({
        ...msg,
        text: msg.iv ? decryptSafely({ iv: msg.iv, encryptedData: msg.text }) : msg.text,
        iv: undefined,
        replyTo: msg.replyTo ? {
            ...msg.replyTo,
            text: msg.replyTo.iv ? decryptSafely({ iv: msg.replyTo.iv, encryptedData: msg.replyTo.text }) : msg.replyTo.text,
            iv: undefined,
        } : null,
    }));
    
      const io = getIO();
      const recipientSocketId = getRecipientSocketId(otherUserId);
      if (recipientSocketId) {
          io.to(recipientSocketId).emit("messagesSeen", { conversationId: conversation._id });
      }

      res.status(200).json(decryptedMessages);
  } catch (error) {
      console.error("Error in getMessages:", error.message);
      res.status(500).json({ error: error.message });
  }
};



export const reactTomsg = async (req, res) => {
  try {
      const { messageId, emoji } = req.body;
      const userId = req.user._id;

      
      if (!messageId || !emoji) {
          return res.status(400).json({ error: "Message ID and emoji are required" });
      }

      
      const message = await Message.findById(messageId);
      if (!message) {
          return res.status(404).json({ error: "Message not found", 
          params:  req.body});
      }

      // Find if the user already reacted
      const existingReactionIndex = message.reactions.findIndex(
          (reaction) => reaction.user.toString() === userId.toString()
      );

      if (existingReactionIndex !== -1) {
          // Update existing reaction
          message.reactions[existingReactionIndex].type = emoji;
      } else {
          // Add new reaction
          message.reactions.push({ user: userId, type: emoji });
      }

      // Save the message
      await message.save();

      // Populate reactions with user details
      const populatedMessage = await Message.findById(messageId)
          .populate({
            path: 'reactions',
            select: 'user type',
            populate: { path: 'user', select: 'username profileImg' }
          });

      // Respond with updated message
      res.status(200).json(populatedMessage);
  } catch (error) {
      console.error("Error in reactToMsg:", error.message);
      res.status(500).json({ error: "Internal Server Error" });
  }
};


export const getConversation = async (req, res) => {
  try {
    const currentUserId = req.user._id.toString();

   
    const conversations = await Conversation.find({
      participants: currentUserId,
    }).populate({
      path: "participants",
      select: "username profileImg",
    });

    
    const convoData = conversations.map((convo) => {
     
      const filteredParticipants = convo.participants.filter(
        (participant) => participant._id.toString() !== currentUserId
      );

      
      const decryptedMessage = (() => {
        try {
          return decrypt({
            iv: convo.lastMessage?.iv,
            encryptedData: convo.lastMessage?.text,
          });
        } catch {
          return "[Decryption failed]";
        }
      })();

      
      return {
        _id: convo._id, 
        participants: filteredParticipants.map((participant) => ({
          _id: participant._id,
          username: participant.username,
          profileImg: participant.profileImg,
        })),
        lastMessage: {
          text: decryptedMessage,
          sender: convo.lastMessage?.sender || null, 
          seen: convo.lastMessage?.seen || false, 
        },
        updatedAt: convo.updatedAt,
      };
    });

    res.status(200).json(convoData);
  } catch (error) {
    console.error("Error in getConversation:", error.message);
    res.status(500).json({ error: "Failed to fetch conversations" });
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
         const io = getIO();
         recipientSocketIds.forEach(socketId => {
             io.to(socketId).emit("messageEdited", message);
         });

       

        const decryptMessage = (() => {
          try {
            return decrypt({
              iv: message.iv, encryptedData: message.text
            });
          } catch {
            return "[Decryption failed]";
          }
        })();
    
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
  const { recipientId, messageId, message } = req.body;
  const senderId = req.user._id;
  let img = "";
  let video = "";
  let audio = "";
  try {
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
      } else if (req.file.mimetype.startsWith("audio/")) {
        audio = publicUrl;
      }
    }


    const encryptedMessage = encrypt(message);

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
      iv: encryptedMessage.iv,
      img: img,
      video: video,
      audio: audio,
      replyTo: parentMessage._id
    });


    const savedReplyMessage = await replyMessage.save();
    const populatedReplyMessage = await savedReplyMessage.populate('sender', 'username profileImg');

    const decryptParentMessage = decrypt({ iv: parentMessage.iv, encryptedData: parentMessage.text });

    const decrytreplyMessage = decrypt({ iv: populatedReplyMessage.iv, encryptedData: populatedReplyMessage.text })

   
    res.status(201).json({
      messageId: populatedReplyMessage._id,
      conversationId: populatedReplyMessage.conversationId,
      sender: {
        id: populatedReplyMessage.sender._id,
        username: populatedReplyMessage.sender.username,
        profileImg: populatedReplyMessage.sender.profileImg
      },
      text: decrytreplyMessage,
      img:populatedReplyMessage.img,
      video: populatedReplyMessage.video,
      audio: populatedReplyMessage.audio,
      type: "text",
      replyTo: {
        messageId: parentMessage._id,
        text: decryptParentMessage,
        img:parentMessage.img,
        video: parentMessage.video,
        audio: parentMessage.audio,
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
  // Fix: get messageId from req.body or req.query or req.params
  let messageId = req.body.messageId || req.query.messageId || req.params.messageId;
  if (!messageId) {
    // Try to get messageId from nested body (for some clients)
    if (req.body && typeof req.body === 'object') {
      messageId = req.body["messageId"];
    }
  }
  const userId = req.user._id;

  console.log('typeof messageId:', typeof messageId);
  console.log('messageId:', messageId);

  try {
      if (!messageId) {
          return res.status(400).json({ error: "Message ID is required" });
      }
      const message = await Message.findById(messageId);
      console.log('message:', message);
      if (!message) {
          return res.status(404).json({ error: "Message not found" });
      }

      // Fix: get recipient from conversation
      const conversation = await Conversation.findById(message.conversationId).lean();
      let recipientId = null;
      if (conversation && conversation.participants) {
          recipientId = conversation.participants.find(
              (id) => id.toString() !== userId.toString()
          );
      }

      if (message.sender.toString() !== userId.toString()) {
          return res.status(403).json({ error: "Not authorized to delete this message" });
      }
      message.deletedFor.push(userId);
      await message.save();

      const io = getIO();
      if (recipientId) {
          const recipientSocketId = getRecipientSocketId(recipientId);
          if (recipientSocketId) {
              io.to(recipientSocketId).emit("messageDeleted", { messageId });
          }
      }

      res.status(200).json({ success: true, message });
  } catch (error) {
      console.error("Error in deleteMessage:", error.message);
      res.status(500).json({ error: error.message });
  }
};


