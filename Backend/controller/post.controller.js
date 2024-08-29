import Post from "../models/post.model.js";
import User from "../models/user.model.js";
import Notification from "../models/notification.model.js";
import { v2 as cloudinary } from "cloudinary";
import mongoose from "mongoose";
import Message from "../models/message.model.js";
import Conversation from "../models/conversation.model.js";


export const NewPost = async(req,res)=>{
    try {
        const { caption } = req.body;
        const userId = req.user._id;
        let { PostImg } = req.body;

        if( PostImg ){
          const uploadedNewProfileImg=await cloudinary.uploader.upload(PostImg);
          PostImg=uploadedNewProfileImg.secure_url;
        }

        const newPost= new Post ({
            postedBy:userId,
            caption,
            images:PostImg
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
    const { postId } = req.params;
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
    const { postId } = req.params;
    const userId = req.user._id;

    if (!userId) {
      return res.status(400).json({ message: "User ID required." });
    }
    if (!comment) {
      return res.status(400).json({ message: "Comment required." });
    }

    const user = await User.findById(userId).select("profileImg username");
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const profileImg = user.profileImg;
    const post = await Post.findById(postId);
    if (!post) {
      return res.status(404).json({ message: "Post not found" });
    }


    post.replies.push({
      userId,
      comment,
      profileImg: user.profileImg,
      username: user.username,
    });

    await post.save();
    res.status(200).json(post);
  } catch (error) {
    res.status(500).json({ message: error.message });
    console.error("Error in addReply:", error.message);
  }
};

export const DeletePost = async (req, res) => {
  try {
    const { postId } = req.params;
    const userId = req.user._id;

   
    const post = await Post.findById(postId);
    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }

    if (post.postedBy.toString() !== userId.toString()) {
      return res.status(403).json({ error: "You can't delete others' posts" });
    }

    if (post.images) {
      
      await cloudinary.uploader.destroy(post.images.split("/").pop().split(".")[0]);
    }

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
      return res.status(404).json({ message: 'Posts collection does not exist' });
    }

    await Post.collection.drop();
    await User.collection.drop();
    await Notification.collection.drop();
    await Message.collection.drop();
    await Conversation.collection.drop();


    return res.status(200).json({ message: 'Posts,user,notification,msg,Convo  deleted successfully' });
  } catch (error) {
    console.error('Error deleting posts collection:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

export const getPost = async (req, res) => {
  try {
    const post = await Post.findById(req.params.id).populate('replies.user'); // Assuming 'replies.user' is how you reference replied users
    if (!post) return res.status(404).json({ error: "Post not found" })
    return res.status(200).json(post);

  } catch (error) {
    console.error('Error in getPost controller:', error);
    return res.status(500).json({ error: 'Internal server error' });
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

   
    const feedPosts = await Post.find({ postedBy: { $in: following } }).sort({ createdAt: -1 });


    res.status(200).json(feedPosts);
  } catch (err) {
    console.error('Error in getFeedPosts controller:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getUserPosts = async (req, res) => {
  try {
    const userId = req.params.id;
    const user = await User.findById(userId).select('-password');
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const userPosts = await Post.find({ postedBy: userId }).sort({ createdAt: -1 });
    res.status(200).json(userPosts);

  }catch(error){
    console.error('Error in getUserPosts controller:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}