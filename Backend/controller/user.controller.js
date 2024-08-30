import User from "../models/user.model.js";
import Notification from "../models/notification.model.js";
import Post from "../models/post.model.js"
import bcrypt from "bcryptjs";
import { PutObjectCommand, GetObjectCommand,DeleteObjectCommand } from "@aws-sdk/client-s3"
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { s3,generateFileName } from "../lib/utils/uploader.js";



export const followUnfollowUser = async (req, res) => {
  
    try{
        const { id } =req.params;
        const userToModify = await User.findById(id);
        const currentUser = await User.findById(req.user._id);

        if(id===req.user._id.toString()) {
            return res.status(400).json({error:"you can't follow/unfollow yourself"});
        }

        if(!userToModify || !currentUser ) return res.status(400).json({error: "User not found"});

        const isFollowing = currentUser.following.includes(id);

        if(isFollowing){

            await User.findByIdAndUpdate(id, { $pull: { followers:req.user._id}});
            await User.findByIdAndUpdate(req.user._id, { $pull: {following: id}});
            res.status(200).json({message:"User unfollowed successfully"});
        }else{
          
            await User.findByIdAndUpdate(id, { $push: { followers:req.user._id}});
            await User.findByIdAndUpdate(req.user._id, { $push: {following: id}});

            const newNotification= new Notification({
                type:"follow",
                from: req.user._id,
                to:userToModify._id,
            });
            await newNotification.save();
            res.status(200).json({message:"User followed successfully"});
        }
      

    }catch(error){
        res.status(500).json({error:error.message});
        console.log("Error in followUnfollowUser:",error.message);
    }
};







export const getUserProfile = async (req, res) => {
    try {
        const { userId } = req.params;
        const currentUserId = req.user._id;

      const profileId= userId || currentUserId;
    
        const user = await User.findById(profileId).select("-password");

        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }

        
        if (user.profileImg) {
            const getObjectParams = {
                Bucket: process.env.BUCKET_NAME,
                Key: user.profileImg,
            };
            const command = new GetObjectCommand(getObjectParams);
            const url = await getSignedUrl(s3, command, { expiresIn: 3600 });
            user.profileImg = url;
        }

        
    

        return res.status(200).json({
            username: user.username,
            fullName: user.fullName,
            bio: user.bio,
            profileImg: user.profileImg,
            followersCount: user.followers.length,
            followingCount: user.following.length,

        });

    } catch (error) {
        console.error("Error in getUserProfile:", error.message);
        res.status(500).json({ error: "Internal Server Error" });
    }
};



export const getSuggestedUser=async(req,res)=>{

    try{
       const userId = req.user._id;

       const userFollowedByme= await User.findById(userId).select("following");
       
       const users=await User.aggregate([
        {
            $match:{
                _id: {$ne:userId}
            }
        },
        {$sample:{size:10}}
    
       ])
       const filtedUser = users.filter(user=>!userFollowedByme.following.includes(user._id))

       const suggeatedUser = filtedUser.slice(0,4);

       suggeatedUser.forEach(user=>user.password=null)

       res.status(200).json(suggeatedUser)
    }catch(error){
        res.status(500).json({error:error.message});
        console.log("Error in suggestedUser:",error.message);  
    }
}



export const UpdateUserProfile = async (req, res) => {
  try {
    const { fullName, username, email, currentPassword, newPassword, bio } = req.body;
    const userId = req.user._id;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Update password logic here...

    let fileName = user.profileImg || "";

    if (req.file) {
      // Delete old profile image from S3
      if (user.profileImg) {
        const deleteParams = {
          Bucket: process.env.BUCKET_NAME,
          Key: user.profileImg,
        };
        const deleteCommand = new DeleteObjectCommand(deleteParams);
        await s3.send(deleteCommand);
      }

      // Upload new profile image to S3
      fileName = generateFileName();
      const uploadParams = {
        Bucket: process.env.BUCKET_NAME,
        Key: fileName,
        Body: req.file.buffer,
        ContentType: req.file.mimetype,
      };
      const uploadCommand = new PutObjectCommand(uploadParams);
      await s3.send(uploadCommand);

      // Generate a new presigned URL and store it
      const getObjectParams = {
        Bucket: process.env.BUCKET_NAME,
        Key: fileName,
      };
      const command = new GetObjectCommand(getObjectParams);
      const url = await getSignedUrl(s3, command, { expiresIn: 3600 }); // 1 hour
      user.profileImg = url;
    }

    user.fullName = fullName || user.fullName;
    user.username = username || user.username;
    user.email = email || user.email;
    user.bio = bio || user.bio;

    const updatedUser = await user.save();

    return res.status(200).json(updatedUser);
  } catch (error) {
    console.error("Error in UpdateUserProfile:", error.message);
    return res.status(500).json({ error: error.message });
  }
};

export const getUserProfileImage = async (req, res) => {
  try {
    const userId = req.user._id;

    const user = await User.findById(userId).select("profileImg");
    if (!user || !user.profileImg) {
      return res.status(404).json({ message: "Profile image not found" });
    }

   
    const url = user.profileImg;
    const now = new Date();
    const expiresAt = new Date(user.profileImgExpiresAt); 

    if (now > expiresAt) {
      const getObjectParams = {
        Bucket: process.env.BUCKET_NAME,
        Key: fileName,
      };
      const command = new GetObjectCommand(getObjectParams);
      const newUrl = await getSignedUrl(s3, command, { expiresIn: 3600 }); 
      user.profileImg = newUrl;
      user.profileImgExpiresAt = new Date(now.getTime() + 3600 * 1000); 

      await user.save();
    }

    return res.status(200).json({ profileImg: user.profileImg });
  } catch (error) {
    console.error("Error in getUserProfileImage:", error.message);
    return res.status(500).json({ error: error.message });
  }
};