import { s3, generateFileName } from "../lib/utils/uploader.js";
import Post from "../models/post.model.js";
import User from "../models/user.model.js";
import Notification from "../models/notification.model.js";
import { PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import mongoose from "mongoose";


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


        const newPost= new Post ({
            postedBy:userId,
            caption,
            images:fileName
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
      return res.status(400).json({ message: 'User ID required.' });
    }
    if (!comment) {
      return res.status(400).json({ message: 'Comment required.' });
    }

    const user = await User.findById(userId).select('profileImg username');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

  
    const profileImg = user.profileImg;
    console.log(profileImg);

  
    const post = await Post.findByIdAndUpdate(
      postId,
      {
        $push: {
          replies: {
            userId,
            comment,
            ProfileImg: profileImg, 
            username: user.username,
          },
        },
      },
      { new: true } 
    );

    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }
    let profileImgUrl="";
    if(profileImg!=""){
      const getObjectParams = {
        Bucket: process.env.BUCKET_NAME,
        Key: user.profileImg,
      };
      const command = new GetObjectCommand(getObjectParams);
       profileImgUrl = await getSignedUrl(s3, command, { expiresIn: 3600 });
    }
    post.replies[post.replies.length - 1].ProfileImg =profileImgUrl;
   
    res.status(200).json(post);
  } catch (error) {
    res.status(500).json({ message: error.message });
    console.error("Error in addReply:", error.message);
  }
};


export const EditPost = async (req, res) => {
  try {
    const { postId } = req.params;
    const userId = req.user._id;
    const { caption } = req.body;
    const newFile = req.file;

    
    const post = await Post.findById(postId);
    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }

    
    if (post.postedBy.toString() !== userId.toString()) {
      return res.status(403).json({ error: "You can't edit others' posts" });
    }

    let newFileName = post.images;

    if (newFile) {
      
      if (post.images) {
        const deleteParams = {
          Bucket: process.env.BUCKET_NAME,
          Key: post.images,
        };
        console.log("Deleting file from S3 with Key:", deleteParams.Key);
        const deleteCommand = new DeleteObjectCommand(deleteParams);
        await s3.send(deleteCommand);
      }

      
      newFileName = generateFileName();
      if (!newFileName) {
        throw new Error('Failed to generate a new file name for S3 upload.');
      }
      const uploadParams = {
        Bucket: process.env.BUCKET_NAME,
        Key: newFileName,
        Body: newFile.buffer,
        ContentType: newFile.mimetype,
      };
      console.log("Uploading new file to S3 with Key:", uploadParams.Key);
      const uploadCommand = new PutObjectCommand(uploadParams);
      await s3.send(uploadCommand);
    }

  
    post.caption = caption || post.caption;
    post.images = newFileName;

   
    const updatedPost = await post.save();
    let updatedPostImg = "";

    if (updatedPost) {
      
      if (updatedPost.images) {
        const getObjectParams = {
          Bucket: process.env.BUCKET_NAME,
          Key: updatedPost.images,
        };
        console.log("Generating signed URL for S3 object with Key:", getObjectParams.Key);
        const command = new GetObjectCommand(getObjectParams);
        updatedPostImg = await getSignedUrl(s3, command, { expiresIn: 3600 });
      }
    }

    updatedPost.images = updatedPostImg;
    res.status(200).json(updatedPost);

  } catch (error) {
    res.status(500).json({ message: error.message });
    console.error('Error in EditPost:', error);
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

    if (!post.images) {
      return res.status(400).json({ error: "No image found for the post" });
    }

    
    const deleteParams = {
      Bucket: process.env.BUCKET_NAME,
      Key: post.images, 
    };

    console.log('Deleting file from S3 with Key:', deleteParams.Key);
    const deleteCommand = new DeleteObjectCommand(deleteParams);
    await s3.send(deleteCommand);


    await Post.findByIdAndDelete(postId);

    return res.status(200).json({ message: 'Post deleted successfully' });
  } catch (error) {
    console.error('Error deleting post:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};





// export const deletePostsCollection = async (req, res) => {
//   try {
    
//     const collectionExists = await mongoose.connection.db
//       .listCollections({ name: Post.collection.collectionName })
//       .hasNext();

//     if (!collectionExists) {
//       return res.status(404).json({ message: 'Posts collection does not exist' });
//     }

//     await Post.collection.drop();

//     return res.status(200).json({ message: 'Posts collection deleted successfully' });
//   } catch (error) {
//     console.error('Error deleting posts collection:', error);
//     return res.status(500).json({ error: 'Internal server error' });
//   }
// };
