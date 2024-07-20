import { s3, generateFileName } from "../lib/utils/uploader.js"
import { PutObjectCommand } from "@aws-sdk/client-s3";
import Post from "../models/post.model.js";


export const NewPost = async(req,res)=>{
    try {
        const { text } = req.body;
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
            text,
            img:fileName
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

export const likePost = async(req,res)=>{
    try {
        const { postId } = req.params;
    
        
        const post = await Post.findByIdAndUpdate(
          postId,
          { $inc: { likes: 1 } },
          { new: true }
        );
    
        if (!post) {
          return res.status(404).json({ message: 'Post not found' });
        }
    
        res.status(200).json(post);
      } catch (error) {
        res.status(500).json({ message: error.message });
        console.log("Error in likePost:", error.message);
      }
}

export const addReply = async(req,res)=>{
    try {
        const { postId } = req.params;
    const { userId, text, userProfileImg, username } = req.body;

    if (!userId || !text) {
      return res.status(400).json({ message: 'User ID and text are required.' });
    }

    
    const post = await Post.findByIdAndUpdate(
      postId,
      {
        $push: {
          replies: { userId, text, userProfileImg, username },
        },
      },
      { new: true }
    );

    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }

    res.status(200).json(post);
    } catch (error) {
        res.status(500).json({ message: error.message });
        console.log("Error in addReply:", error.message);
    }
}

export const EditPost = async(req,res)=>{
   
    try {
        const { postId } = req.params;
        const userId = req.user._id;
        const { text } = req.body; 
    
       
        const post = await Post.findById(postId);
    
        
        if (!post) {
          return res.status(404).json({ message: 'Post not found' });
        }
    
        
        if (post.postedBy.toString() !== userId.toString()) {
          return res.status(403).json({ error: "You can't edit others' posts" });
        }
    
        
        post.text = text || post.text;
        post.img = img || post.img;
    
        
        const updatedPost = await post.save();
    
        res.status(200).json(updatedPost);
      } catch (error) {
        res.status(500).json({ message: error.message });
      }
    
}
