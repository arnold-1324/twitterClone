import moment from "moment";  
import { s3, generateFileName } from "../lib/utils/uploader.js";
import Conversation from "../models/conversation.model.js";
import Message from "../models/message.model.js";
import Group from "../models/group.model.js";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getIO, getRecipientSocketId } from "../socket/socket.js";
import { encrypt, decrypt } from "../lib/utils/Msg_encryption/encrypt.js";


export const sendMessage = async (req, res) => {
  const { recipientId, message, groupId } = req.body;
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

    let conversation;
    let isGroupMessage = false;

    // Check if this is a group message
    if (groupId) {
      isGroupMessage = true;
      
      // Verify user is member of the group
      const group = await Group.findById(groupId);
      if (!group) {
        return res.status(404).json({ error: "Group not found" });
      }
      
      if (!group.members.includes(senderId)) {
        return res.status(403).json({ error: "You are not a member of this group" });
      }

      // Check if group has conversation, if not create one
      if (!group.conversation) {
        conversation = new Conversation({
          participants: group.members,
          lastMessage: {
            text: encryptedMessage.encryptedData,
            iv: encryptedMessage.iv,
            sender: senderId,
          },
        });
        await conversation.save();
        
        // Update group with conversation reference
        group.conversation = conversation._id;
        await group.save();
      } else {
        // Update existing conversation
        conversation = await Conversation.findByIdAndUpdate(
          group.conversation,
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
      }
    } else {
      // Regular one-on-one message
      // Find or create a conversation
      conversation = await Conversation.findOneAndUpdate(
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

   // console.log(newMessage);

     const decryptedMessage = decrypt({
      iv: newMessage.iv,
      encryptedData: newMessage.text,
    });

   // console.log(newMessage);

        const socketPayload = {
      ...newMessage._doc,
      text: decryptedMessage,
      iv:    undefined,
      isGroupMessage,
      groupId: groupId || null
    }; 
     // Save the message to the database   

    // Notify recipients via socket (if online)
    const io = getIO();
    
    if (isGroupMessage) {
      // For group messages, emit to all group members except the sender
      const group = await Group.findById(groupId).lean();
      if (group) {
        group.members
          .filter(memberId => memberId.toString() !== senderId.toString())
          .forEach(memberId => {
            const memberSocketId = getRecipientSocketId(memberId.toString());
            if (memberSocketId) {
              io.to(memberSocketId).emit("newGroupMessage", {
                message: socketPayload,
                groupId: groupId,
                conversationId: conversation._id
              });
            }
          });
      }
    } else {
      // For one-on-one messages
      const recipientSocketId = getRecipientSocketId(recipientId);
      if (recipientSocketId) {
        io.to(recipientSocketId).emit("newMessage", socketPayload);
        io.to(recipientSocketId).emit("stopTyping", { conversationId: conversation._id });
      }
    }


    const responseMessage = {
      ...newMessage._doc,
      text: decryptedMessage,  // Decrypted message text
      iv: undefined,  // Remove the iv from the response
      isGroupMessage: isGroupMessage,
      groupId: groupId || null
    };

    res.status(201).json(responseMessage);  // Send the message back with media URL

  } catch (error) {
    console.error("Error in sendMessage:", error.message);
    res.status(500).json({ error: error.message });
  }
};





export const getMessages = async (req, res) => {
  const { otherUserId, groupId } = req.params;
  const userId = req.user._id;

  try {
    let conversation;
    let isGroupConversation = false;

    if (groupId) {
      // Group conversation
      isGroupConversation = true;
      
      // Verify user is member of the group
      const group = await Group.findById(groupId);
      if (!group) {
        return res.status(404).json({ error: "Group not found" });
      }
      
      if (!group.members.includes(userId)) {
        return res.status(403).json({ error: "You are not a member of this group" });
      }

      if (!group.conversation) {
        return res.status(404).json({ error: "No conversation found for this group" });
      }

      conversation = await Conversation.findById(group.conversation).lean();
    } else {
      // One-on-one conversation
      conversation = await Conversation.findOne({ 
        participants: { $all: [userId, otherUserId] } 
      }).lean();
    }

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
      isGroupMessage: isGroupConversation,
      groupId: groupId || null
    }));
    
    const io = getIO();
    
    if (isGroupConversation) {
      // For group conversations, notify all group members
      const group = await Group.findById(groupId).populate('members');
      const memberIds = group.members
        .filter(member => member._id.toString() !== userId.toString())
        .map(member => member._id.toString());
      
      memberIds.forEach(memberId => {
        const memberSocketId = getRecipientSocketId(memberId);
        if (memberSocketId) {
          io.to(memberSocketId).emit("messagesSeen", { 
            conversationId: conversation._id,
            groupId: groupId 
          });
        }
      });
    } else {
      // For one-on-one conversations
      const recipientSocketId = getRecipientSocketId(otherUserId);
      if (recipientSocketId) {
        io.to(recipientSocketId).emit("messagesSeen", { conversationId: conversation._id });
      }
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

    // 1:1 conversations
    const conversations = await Conversation.find({
      participants: currentUserId,
    }).populate({
      path: "participants",
      select: "username profileImg",
    });

    // group conversations where user is a member
    const userGroups = await Group.find({
      members: currentUserId,
      conversation: { $exists: true, $ne: null },
    })
      .select("name description profileImage owner admins members conversation")
      .populate({
        path: "conversation",
        populate: {
          path: "participants",
          select: "username profileImg",
        },
      })
      .populate({
        path: "members",
        select: "username profileImg",
      });

    // map 1:1
    const convoData = conversations.map((convo) => {
      const others = convo.participants.filter(
        (p) => p._id.toString() !== currentUserId
      );
      let decryptedText;
      try {
        decryptedText = decrypt({
          iv: convo.lastMessage?.iv,
          encryptedData: convo.lastMessage?.text,
        });
      } catch {
        decryptedText = "[Decryption failed]";
      }
      return {
        _id: convo._id,
        participants: others.map((p) => ({
          _id: p._id,
          username: p.username,
          profileImg: p.profileImg,
        })),
        lastMessage: {
          text: decryptedText,
          sender: convo.lastMessage?.sender || null,
          seen: convo.lastMessage?.seen || false,
        },
        updatedAt: convo.updatedAt,
        isGroup: false,
        groupId: null,
      };
    });

    // map group chats
    const groupConvoData = userGroups.map((group) => {
      let decryptedText;
      try {
        decryptedText = decrypt({
          iv: group.conversation.lastMessage?.iv,
          encryptedData: group.conversation.lastMessage?.text,
        });
      } catch {
        decryptedText = "[Decryption failed]";
      }
      return {
        _id: group.conversation._id,
        groupInfo: {
          _id: group._id,
          name: group.name,
          description: group.description,
          profileImage: group.profileImage,
          owner: group.owner,
          admins: group.admins,
        },
        participants: group.members.map((m) => ({
          _id: m._id,
          username: m.username,
          profileImg: m.profileImg,
        })),
        lastMessage: {
          text: decryptedText,
          sender: group.conversation.lastMessage?.sender || null,
          seen: group.conversation.lastMessage?.seen || false,
        },
        updatedAt: group.conversation.updatedAt,
        isGroup: true,
        groupId: group._id,
      };
    });

    // merge & sort
    const allConversations = [...convoData, ...groupConvoData].sort(
      (a, b) => new Date(b.updatedAt) - new Date(a.updatedAt)
    );

    res.status(200).json(allConversations);
  } catch (error) {
    console.error("Error in getConversation:", error);
    res.status(500).json({ error: "Failed to fetch conversations" });
  }
};


export const getGroupConversationInfo = async (req, res) => {
  const { groupId } = req.params;
  const userId = req.user._id;

  try {
    const group = await Group.findById(groupId)
      .populate('members', 'username profileImg')
      .populate('admins', 'username profileImg')
      .populate('owner', 'username profileImg')
      .populate({
        path: 'conversation',
        populate: {
          path: 'participants',
          select: 'username profileImg'
        }
      });

    if (!group) {
      return res.status(404).json({ error: "Group not found" });
    }

    if (!group.members.some(member => member._id.toString() === userId.toString())) {
      return res.status(403).json({ error: "You are not a member of this group" });
    }

    // Decrypt last message if exists
    let decryptedLastMessage = null;
    if (group.conversation && group.conversation.lastMessage) {
      try {
        decryptedLastMessage = decrypt({
          iv: group.conversation.lastMessage.iv,
          encryptedData: group.conversation.lastMessage.text,
        });
      } catch {
        decryptedLastMessage = "[Decryption failed]";
      }
    }

    const groupInfo = {
      _id: group._id,
      name: group.name,
      description: group.description,
      owner: group.owner,
      admins: group.admins,
      members: group.members,
      permissions: group.permissions,
      conversationId: group.conversation?._id || null,
      lastMessage: decryptedLastMessage ? {
        text: decryptedLastMessage,
        sender: group.conversation.lastMessage.sender,
        seen: group.conversation.lastMessage.seen || false
      } : null,
      updatedAt: group.conversation?.updatedAt || group.updatedAt,
      createdAt: group.createdAt
    };

    res.status(200).json(groupInfo);
  } catch (error) {
    console.error("Error in getGroupConversationInfo:", error.message);
    res.status(500).json({ error: error.message });
  }
};

export const editMessage = async (req, res) => {
    const { messageId, newText, groupId } = req.body;
    const userId = req.user._id;

    try {
        const encryptedMessage = encrypt(newText);

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

        // Determine if this is a group message
        let isGroupMessage = false;
        if (groupId || (conversation && conversation.participants.length > 2)) {
            isGroupMessage = true;
            
            // If groupId not provided, find it
            if (!groupId) {
                const group = await Group.findOne({ conversation: conversation._id });
                if (group) {
                    groupId = group._id;
                }
            }
        }

        // Get recipient socket IDs
        const io = getIO();
        let recipientSocketIds = [];
        
        if (isGroupMessage) {
            // For group messages, notify all group members except sender
            const group = await Group.findById(groupId).populate('members');
            if (group) {
                recipientSocketIds = group.members
                    .filter(member => member._id.toString() !== userId.toString())
                    .map(member => getRecipientSocketId(member._id.toString()))
                    .filter(socketId => socketId); // Remove undefined socket IDs
            }
        } else {
            // For one-on-one messages
            const recipientId = conversation.participants.find(
                participant => participant._id.toString() !== userId.toString()
            );
            if (recipientId) {
                const recipientSocketId = getRecipientSocketId(recipientId._id.toString());
                if (recipientSocketId) {
                    recipientSocketIds = [recipientSocketId];
                }
            }
        }

        // Emit to all recipients
        recipientSocketIds.forEach(socketId => {
            io.to(socketId).emit("messageEdited", {
                ...message.toObject(),
                isGroupMessage,
                groupId: groupId || null
            });
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
    
        const responsMessage = {
          ...message._doc,
          text: decryptMessage,
          iv: undefined,
          isGroupMessage,
          groupId: groupId || null
        };

        res.status(200).json(responsMessage);
    } catch (error) {
        res.status(500).json({ error: error.message });
        console.log("Error in editMessage:", error.message);
    }
};


export const sendGroupMessage = async (req, res) => {
  const { groupId, message } = req.body;
  const senderId = req.user._id;

  let img = "";
  let video = "";
  let audio = "";

  try {
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
      } else if (req.file.mimetype.startsWith("audio/")) {
        audio = publicUrl;
      }
    }

    // Verify user is member of the group
    const group = await Group.findById(groupId);
    if (!group) {
      return res.status(404).json({ error: "Group not found" });
    }

    if (!group.members.includes(senderId)) {
      return res.status(403).json({ error: "You are not a member of this group" });
    }

    // Check group permissions
    if (group.permissions.canMessage === "admins" && !group.admins.includes(senderId)) {
      return res.status(403).json({ error: "Only admins can send messages in this group" });
    }

    if (group.permissions.canMessage === "owner" && group.owner.toString() !== senderId.toString()) {
      return res.status(403).json({ error: "Only the owner can send messages in this group" });
    }

    // Encrypt the message
    const encryptedMessage = encrypt(message);

    let conversation;
    // Check if group has conversation, if not create one
    if (!group.conversation) {
      conversation = new Conversation({
        participants: group.members,
        lastMessage: {
          text: encryptedMessage.encryptedData,
          iv: encryptedMessage.iv,
          sender: senderId,
        },
      });
      await conversation.save();

      // Update group with conversation reference
      group.conversation = conversation._id;
      await group.save();
    } else {
      // Update existing conversation
      conversation = await Conversation.findByIdAndUpdate(
        group.conversation,
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
    }

    // Create the message
    let newMessage = new Message({
      conversationId: conversation._id,
      sender: senderId,
      text: encryptedMessage.encryptedData,
      img: img,
      video: video,
      audio: audio,
      iv: encryptedMessage.iv,
    });

    await newMessage.save();

    // Populate sender for the new message
    newMessage = await newMessage.populate('sender', 'username profileImg');

    // Decrypt message for response
    const decryptedMessage = decrypt({
      iv: newMessage.iv,
      encryptedData: newMessage.text,
    });

    const responseMessage = {
      ...newMessage._doc,
      text: decryptedMessage,
      iv: undefined,
      isGroupMessage: true,
      groupId: groupId
    };

    // Notify all group members via conversation room with the fully populated and decrypted message
    const io = getIO();
    io.to(conversation._id.toString()).emit("newGroupMessage", {
      message: responseMessage,
      groupId: groupId,
      conversationId: conversation._id
    });

    res.status(201).json(responseMessage);
  } catch (error) {
    console.error("Error in sendGroupMessage:", error.message);
    res.status(500).json({ error: error.message });
  }
};

export const replyToMessage = async (req, res) => {
  const { recipientId, messageId, message, groupId } = req.body;
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

    let conversation;
    let isGroupReply = false;

    if (groupId) {
      // Group reply
      isGroupReply = true;
      
      // Verify user is member of the group
      const group = await Group.findById(groupId);
      if (!group) {
        return res.status(404).json({ error: "Group not found" });
      }
      
      if (!group.members.includes(senderId)) {
        return res.status(403).json({ error: "You are not a member of this group" });
      }

      if (!group.conversation) {
        return res.status(404).json({ error: "No conversation found for this group" });
      }

      conversation = await Conversation.findById(group.conversation);
    } else {
      // One-on-one reply
      conversation = await Conversation.findOneAndUpdate(
        { participants: { $all: [senderId, recipientId] } },
        { text: encryptedMessage.encryptedData, edited: true, iv: encryptedMessage.iv },
        { new: true, upsert: true }
      );
    }

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
    const decrytreplyMessage = decrypt({ iv: populatedReplyMessage.iv, encryptedData: populatedReplyMessage.text });

    // Notify recipients
    const io = getIO();
    
    if (isGroupReply) {
      // For group replies, notify all group members except sender
      const group = await Group.findById(groupId).populate('members');
      const recipientIds = group.members
        .filter(member => member._id.toString() !== senderId.toString())
        .map(member => member._id.toString());
      
      recipientIds.forEach(recipientId => {
        const recipientSocketId = getRecipientSocketId(recipientId);
        if (recipientSocketId) {
          io.to(recipientSocketId).emit("newGroupMessage", {
            message: populatedReplyMessage,
            groupId: groupId,
            conversationId: conversation._id
          });
        }
      });
    } else {
      // For one-on-one replies
      const recipientSocketId = getRecipientSocketId(recipientId);
      if (recipientSocketId) {
        io.to(recipientSocketId).emit("newMessage", populatedReplyMessage);
      }
    }

    res.status(201).json({
      messageId: populatedReplyMessage._id,
      conversationId: populatedReplyMessage.conversationId,
      sender: {
        id: populatedReplyMessage.sender._id,
        username: populatedReplyMessage.sender.username,
        profileImg: populatedReplyMessage.sender.profileImg
      },
      text: decrytreplyMessage,
      img: populatedReplyMessage.img,
      video: populatedReplyMessage.video,
      audio: populatedReplyMessage.audio,
      type: "text",
      replyTo: {
        messageId: parentMessage._id,
        text: decryptParentMessage,
        img: parentMessage.img,
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
      updatedAt: populatedReplyMessage.updatedAt,
      isGroupMessage: isGroupReply,
      groupId: groupId || null
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
    console.log("Error in replyToMessage:", error.message);
  }
};


export const getGroupMessages = async (req, res) => {
  const { groupId } = req.params;
  const userId = req.user._id;

  try {
    // Verify user is member of the group
    const group = await Group.findById(groupId);
    if (!group) {
      return res.status(404).json({ error: "Group not found" });
    }

    if (!group.members.includes(userId)) {
      return res.status(403).json({ error: "You are not a member of this group" });
    }

    if (!group.conversation) {
      return res.status(404).json({ error: "No conversation found for this group" });
    }

    const conversation = await Conversation.findById(group.conversation).lean();

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
        return decrypt({ iv, encryptedData });
      } catch (error) {
        return 'Bad message';
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
      isGroupMessage: true,
      groupId: groupId
    }));

    // Notify other group members that messages have been seen
    const io = getIO();
    const memberIds = group.members
      .filter(member => member.toString() !== userId.toString())
      .map(member => member.toString());
    
    memberIds.forEach(memberId => {
      const memberSocketId = getRecipientSocketId(memberId);
      if (memberSocketId) {
        io.to(memberSocketId).emit("messagesSeen", { 
          conversationId: conversation._id,
          groupId: groupId 
        });
      }
    });

    res.status(200).json(decryptedMessages);
  } catch (error) {
    console.error("Error in getGroupMessages:", error.message);
    res.status(500).json({ error: error.message });
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

    // Get conversation to determine if it's a group message
    const conversation = await Conversation.findById(message.conversationId).lean();
    let isGroupMessage = false;
    let groupId = null;
    let recipientIds = [];

    if (conversation && conversation.participants.length > 2) {
      // This is likely a group conversation
      isGroupMessage = true;
      
      // Find the group that has this conversation
      const group = await Group.findOne({ conversation: conversation._id });
      if (group) {
        groupId = group._id;
        recipientIds = group.members
          .filter(member => member.toString() !== userId.toString())
          .map(member => member.toString());
      }
    } else {
      // One-on-one conversation
      let recipientId = null;
      if (conversation && conversation.participants) {
        recipientId = conversation.participants.find(
          (id) => id.toString() !== userId.toString()
        );
      }
      if (recipientId) {
        recipientIds = [recipientId.toString()];
      }
    }

    if (message.sender.toString() !== userId.toString()) {
      return res.status(403).json({ error: "Not authorized to delete this message" });
    }
    
    message.deletedFor.push(userId);
    await message.save();

    const io = getIO();
    
    if (isGroupMessage) {
      // For group messages, notify all group members
      recipientIds.forEach(recipientId => {
        const recipientSocketId = getRecipientSocketId(recipientId);
        if (recipientSocketId) {
          io.to(recipientSocketId).emit("messageDeleted", { 
            messageId,
            groupId: groupId
          });
        }
      });
    } else {
      // For one-on-one messages
      if (recipientIds.length > 0) {
        const recipientSocketId = getRecipientSocketId(recipientIds[0]);
        if (recipientSocketId) {
          io.to(recipientSocketId).emit("messageDeleted", { messageId });
        }
      }
    }

    res.status(200).json({ 
      success: true, 
      message,
      isGroupMessage,
      groupId
    });
  } catch (error) {
    console.error("Error in deleteMessage:", error.message);
    res.status(500).json({ error: error.message });
  }
};


