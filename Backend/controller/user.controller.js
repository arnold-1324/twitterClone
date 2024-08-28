import User from "../models/user.model.js";
import Notification from "../models/notification.model.js";
import bcrypt from "bcryptjs";
import { PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3"
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

        
        const isOwnProfile = currentUserId.toString() === userId;
        const isFollowing = user.followers.includes(currentUserId);

        return res.status(200).json({
            username: user.username,
            fullName: user.fullName,
            bio: user.bio,
            profileImg: user.profileImg,
            followersCount: user.followers.length,
            followingCount: user.following.length,
            isFollowing: isFollowing,
            isOwnProfile: isOwnProfile
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
  
      if (req.params.id && req.params.id !== userId.toString()) {
        return res.status(400).json({ error: "You cannot update another user's profile" });
      }
  
      if ((newPassword && !currentPassword) || (!newPassword && currentPassword)) {
        return res.status(400).json({ error: "Please provide both current password and new password" });
      }
  
      if (currentPassword && newPassword) {
        const isMatch = await bcrypt.compare(currentPassword, user.password);
        if (!isMatch) {
          return res.status(400).json({ error: "Current password is incorrect" });
        }
        if (newPassword.length < 6) {
          return res.status(400).json({ error: "Password must be at least 6 characters long" });
        }
        const salt = await bcrypt.genSalt(10);
        user.password = await bcrypt.hash(newPassword, salt);
      }
  
      let fileName = user.profileImg || "";
  
      if (req.file) {
        if (user.profileImg) {
          const deleteParams = {
            Bucket: process.env.BUCKET_NAME,
            Key: user.profileImg,
          };
  
          const deleteCommand = new DeleteObjectCommand(deleteParams);
          await s3.send(deleteCommand);
          console.log("Deleted old profile image:", deleteParams.Key);
        }
  
        fileName = generateFileName();
        const uploadParams = {
          Bucket: process.env.BUCKET_NAME,
          Key: fileName,
          Body: req.file.buffer,
          ContentType: req.file.mimetype,
        };
  
        const uploadCommand = new PutObjectCommand(uploadParams);
        await s3.send(uploadCommand);
        console.log("Uploaded new profile image:", fileName);
      }
  
      user.fullName = fullName || user.fullName;
      user.username = username || user.username;
      user.email = email || user.email;
      user.profileImg = fileName;
      user.bio = bio || user.bio;
  
      const updatedUser = await user.save();
  
      return res.status(200).json(updatedUser);
    } catch (error) {
      console.error("Error in UpdateUserProfile:", error.message);
      return res.status(500).json({ error: error.message });
    }
  };