import { s3, generateFileName } from "../lib/utils/uploader.js";
import Post from "../models/post.model.js";
import User from "../models/user.model.js";
import Notification from "../models/notification.model.js";
import { PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import mongoose from "mongoose";
import Message from "../models/message.model.js";
import Conversation from "../models/conversation.model.js";
import {encrypt} from "../lib/utils/Msg_encryption/encrypt.js";


export const NewPost = async(req,res)=>{
    try {
        const { caption } = req.body;
        const userId = req.user._id;
        const fileName = generateFileName();
        const params = {
            Bucket: process.env.BUCKET_NAME,
            Key: fileName,
            Body:req.file.buffer,
            ContentType:req.file.mimetype,
        }
        const command = new PutObjectCommand(params);
        await s3.send(command);

        const publicUrl = `https://${process.env.BUCKET_NAME}.s3.${process.env.REGION}.amazonaws.com/${fileName}`;
        const newPost= new Post ({
            postedBy:userId,
            caption,
            images:publicUrl
        })
        if(newPost){
         
          await newPost.save();
          res.status(201).json(newPost);
        }

    } catch (error) {
        res.status(500).json({ error: error.message });
      console.log("Error in NewPost:", error.message);
    }
}

export const likePost = async (req, res) => {
  try {
    const { id: postId } = req.params;
    const userId = req.user._id;

    
    const post = await Post.findById(postId);
    if (!post) return res.status(404).json({ message: 'Post not found' });

    
    const isLiked = post.likes.includes(userId);
    if (isLiked) {
      await Post.findByIdAndUpdate(postId, { $pull: { likes: userId } }, { new: true });
      res.status(200).json({ message: 'Post unliked successfully' });
    } else {
      await Post.findByIdAndUpdate(postId, { $push: { likes: userId } }, { new: true });
      
      
      const newNotification = new Notification({
        type: 'like',
        from: userId,
        to: post.postedBy,
        postId: post._id,
      });
      await newNotification.save();

      res.status(200).json({ message: 'Post liked successfully' });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
    console.error('Error in likePost:', error.message);
  }
};

export const addReply = async (req, res) => {
  try {
    const { comment } = req.body;
    const { id: postId } = req.params;
    const userId = req.user._id;

    if ( !comment) {
      return res.status(400).json({ message: " Comment required." });
    }

    const user = await User.findById(userId).select("profileImg username");
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const post = await Post.findById(postId);
    if (!post) {
      return res.status(404).json({ message: "Post not found" });
    }

    const reply = { 
      userId, 
      comment, 
      profileImg:user.profileImg,
      username: user.username
     };

		post.replies.push(reply);
		await post.save();

		res.status(200).json(reply);
  
    
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};


export const DeletePost = async (req, res) => {
  try {
    const { id: postId } = req.params;
    const userId = req.user._id;

   
    const post = await Post.findById(postId);
    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }

    if (post.postedBy.toString() !== userId.toString()) {
      return res.status(403).json({ error: "You can't delete others' posts" });
    }

    if (!post.images) {
      return res.status(400).json({ error: "No image found for the post" });
    }

   

    const deleteParams = {
      Bucket: process.env.BUCKET_NAME,
      Key: post.images.split('/').pop()
    };

    const deleteCommand = new DeleteObjectCommand(deleteParams);
    await s3.send(deleteCommand);
    console.log('Deleting file from S3 with Key:', deleteParams.Key);


    await Post.findByIdAndDelete(postId);

    return res.status(200).json({ message: 'Post deleted successfully' });
  } catch (error) {
    console.error('Error deleting post:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};


export const deletePostsUsersCollection = async (req, res) => {
  try {
    
    const collectionExists = await mongoose.connection.db
      .listCollections({ name: Post.collection.collectionName })
      .hasNext();

      

    if (!collectionExists) {
      return res.status(404).json({ message: 'MSG and Convo does not exist' });
    }

    // await Post.collection.drop();
    // await User.collection.drop();
    // await Notification.collection.drop();
    await Message.collection.drop();
    await Conversation.collection.drop();


    return res.status(200).json({ message: 'msg,Convo  deleted successfully' });
  } catch (error) {
    console.error('Error deleting posts collection:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

// controller/post.controller.js
export const sharepost = async (req, res) => {
  const { postId, conversationId, text } = req.body;
  const senderId = req.user._id;

  if (!postId || !senderId || !conversationId) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  try {
    const post = await Post.findById(postId);
    if (!post) {
      return res.status(404).json({ error: "Post not found" });
    }

    // Ensure sharedBy is array
    if (!Array.isArray(post.sharedBy)) post.sharedBy = [];

    // Update shareCount & sharedBy
    post.shareCount = (post.shareCount || 0) + 1;
    post.sharedBy.push({ userId: senderId, sharedAt: new Date() });

    await post.save();

    // Only encrypt if text is non-empty
    let encryptedMessage = null;
    if (text && typeof text === "string" && text.trim() !== "") {
      // encrypt should return { encryptedData, iv }
      encryptedMessage = encrypt(text);
    }

    // Build message payload – include iv only when encryptedMessage exists
    const messagePayload = {
      conversationId,
      sender: senderId,
      text: encryptedMessage ? encryptedMessage.encryptedData : "", // store empty string when no text
      type: "post",
      ...(encryptedMessage && { iv: encryptedMessage.iv }),
      postReference: postId,
      seen: false,
    };

    const newMessage = new Message(messagePayload);
    await newMessage.save();

    // Fetch updated post for response
    const updatedPost = await Post.findById(postId);

    return res.status(200).json({
      message: "Post shared successfully!",
      post: updatedPost,
      postsharedBy: updatedPost.sharedBy,
      count: updatedPost.shareCount,
      postId,
      messageId: newMessage._id,
    });
  } catch (error) {
    console.error("Error in sharepost controller:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};



export const getPost = async (req, res) => {
  try {
		const post = await Post.findById(req.params.id)
    .populate({
      path: "likes", 
      select: "username profileImg", 
    });;

		if (!post) {
			return res.status(404).json({ error: "Post not found" });
		}

		res.status(200).json(post);
	} catch (err) {
		res.status(500).json({ error: err.message });
	}
};

export const getFeedPosts = async (req, res) => {
  try {
    const userId = req.user._id;
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const following = user.following;

   
   const feedPosts = await Post.find({ postedBy: { $in: following } })
  .sort({ createdAt: -1 })
  .populate({
    path: "likes", 
    select: "username profileImg", 
  });
    res.status(200).json(feedPosts);
  } catch (err) {
    console.error('Error in getFeedPosts controller:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getUserPosts = async (req, res) => {
  const { username } = req.params;
	try {
		const user = await User.findOne({ username });
		if (!user) {
			return res.status(404).json({ error: "User not found" });
		}

    const posts = await Post.find({ postedBy: user._id }).sort({ createdAt: -1 })
      .populate({
        path: "likes",
        select: "username profileImg",
      });;

		res.status(200).json(posts);
	} catch (error) {
		res.status(500).json({ error: error.message });
	}
}
