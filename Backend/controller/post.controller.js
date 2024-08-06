import { s3, generateFileName } from "../lib/utils/uploader.js";
import Post from "../models/post.model.js";
import User from "../models/user.model.js";
import Notification from "../models/notification.model.js";
import { PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";


export const NewPost = async (req, res) => {
  try {
    const { text } = req.body;
    const userId = req.user._id;
    let fileName = null;

   
    if (req.file) {
      fileName = generateFileName();
      const params = {
        Bucket: process.env.BUCKET_NAME,
        Key: fileName,
        Body: req.file.buffer,
        ContentType: req.file.mimetype,
      };

     
      await s3.send(new PutObjectCommand(params));
    }

    
    const newPost = new Post({
      postedBy: userId,
      text,
      images: fileName,
    });
    await newPost.save();
    
    res.status(201).json(newPost);
  } catch (error) {
    res.status(500).json({ error: error.message });
    console.error("Error in NewPost:", error.message);
  }
};


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
    const { postId } = req.params;
    const { text } = req.body;
    const userId = req.user._id;

    if (!userId || !text) return res.status(400).json({ message: 'User ID and text are required' });

  
    const user = await User.findById(userId).select('profileImg username');
    if (!user) return res.status(404).json({ message: 'User not found' });

    
    const profileImgUrl = await getSignedUrl(s3, new GetObjectCommand({
      Bucket: process.env.BUCKET_NAME,
      Key: user.profileImg,
    }), { expiresIn: 3600 });

    
    const post = await Post.findByIdAndUpdate(postId, {
      $push: {
        replies: {
          userId,
          text,
          ProfileImg: profileImgUrl,
          username: user.username,
        },
      },
    }, { new: true, runValidators: true });

    if (!post) return res.status(404).json({ message: 'Post not found' });

    res.status(200).json(post);
  } catch (error) {
    res.status500.json({ message: error.message });
    console.error("Error in addReply:", error.message);
  }
};


export const EditPost = async (req, res) => {
  try {
    const { postId } = req.params;
    const userId = req.user._id;
    const { text, images } = req.body;


    const post = await Post.findById(postId);
    if (!post) return res.status(404).json({ message: 'Post not found' });

   
    if (post.postedBy.toString() !== userId.toString()) return res.status(403).json({ error: "You can't edit others' posts" });

 
    post.text = text || post.text;
    post.images = images || post.images;
    const updatedPost = await post.save();

    res.status(200).json(updatedPost);
  } catch (error) {
    res.status(500).json({ message: error.message });
    console.error("Error in EditPost:", error.message);
  }
};


export const retweetPost = async (req, res) => {
  try {
    const { postId } = req.params;
    const userId = req.user._id;

 
    const post = await Post.findById(postId);
    if (!post) return res.status(404).json({ message: 'Post not found' });


    const isRetweeted = post.retweets.includes(userId);
    if (isRetweeted) {
      await Post.findByIdAndUpdate(postId, { $pull: { retweets: userId } }, { new: true });
      res.status(200).json({ message: 'Post unretweeted successfully' });
    } else {
      await Post.findByIdAndUpdate(postId, { $push: { retweets: userId } }, { new: true });

  
      const newNotification = new Notification({
        type: 'retweet',
        from: userId,
        to: post.postedBy,
        postId: post._id,
      });
      await newNotification.save();

      res.status(200).json({ message: 'Post retweeted successfully' });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
    console.error('Error in retweetPost:', error.message);
  }
};

export const getPosts = async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const posts = await Post.find()
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .populate('postedBy', 'username profileImg')
      .populate('likes', 'username')
      .populate('retweets', 'username')
      .populate('replies.userId', 'username profileImg');

    res.status(200).json(posts);
  } catch (error) {
    res.status(500).json({ error: error.message });
    console.error("Error in getPosts:", error.message);
  }
};
