import User from "../models/user.model.js";
import Notification from "../models/notification.model.js";
import bcrypt from "bcryptjs";
import { PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3"
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { s3,generateFileName } from "../lib/utils/uploader.js";



export const followUnfollowUser = async (req, res) => {
  try {
      const { id } = req.params;
      const currentUserId = req.user._id;

      if (id === currentUserId.toString()) {
          return res.status(400).json({ error: "You can't follow/unfollow yourself" });
      }

      const [userToModify, currentUser] = await Promise.all([
          User.findById(id),
          User.findById(currentUserId)
      ]);

      if (!userToModify || !currentUser) {
          return res.status(404).json({ error: "User not found" });
      }

      const isFollowing = currentUser.following.includes(id);

      if (isFollowing) {
          await Promise.all([
              User.findByIdAndUpdate(id, { $pull: { followers: currentUserId } }),
              User.findByIdAndUpdate(currentUserId, { $pull: { following: id } })
          ]);
          res.status(200).json({ message: "User unfollowed successfully" });
      } else {
          if (userToModify.accountPrivacy === 'private') {
            
              await User.findByIdAndUpdate(currentUserId, { $push: { followRequests: id } });
              res.status(200).json({ message: "Follow request sent" });
          } else {
              await Promise.all([
                  User.findByIdAndUpdate(id, { $push: { followers: currentUserId } }),
                  User.findByIdAndUpdate(currentUserId, { $push: { following: id } })
              ]);

              const newNotification = new Notification({
                  type: "follow",
                  from: currentUserId,
                  to: id
              });
              await newNotification.save();

              res.status(200).json({ message: "User followed successfully" });
          }
      }
  } catch (error) {
      console.error("Error in followUnfollowUser:", error.message);
      res.status(500).json({ error: error.message });
  }
};


export const acceptFollowRequest = async (req, res) => {
  try {
      const { userId } = req.params; 
      const currentUserId = req.user._id; 

      if (userId === currentUserId.toString()) {
          return res.status(400).json({ error: "You can't accept your own request" });
      }

      const [currentUser, userToAccept] = await Promise.all([
          User.findById(currentUserId),
          User.findById(userId)
      ]);

      if (!currentUser || !userToAccept) {
          return res.status(404).json({ error: "User not found" });
      }

      await Promise.all([
          User.findByIdAndUpdate(currentUserId, {
              $addToSet: { followers: userId },
              $pull: { followRequests: userId }
          }),
          User.findByIdAndUpdate(userId, {
              $addToSet: { following: currentUserId }
          })
      ]);

      res.status(200).json({ message: "Follow request accepted" });
  } catch (error) {
      console.error("Error in acceptFollowRequest:", error.message);
      res.status(500).json({ error: error.message });
  }
};


export const declineFollowRequest = async (req, res) => {
  try {
      const { userId } = req.params; 
      const currentUserId = req.user._id; 

      if (userId === currentUserId.toString()) {
          return res.status(400).json({ error: "You can't decline your own request" });
      }

      const currentUser = await User.findById(currentUserId);

      if (!currentUser) {
          return res.status(404).json({ error: "User not found" });
      }

      await User.findByIdAndUpdate(currentUserId, {
          $pull: { followRequests: userId }
      });

      res.status(200).json({ message: "Follow request declined" });
  } catch (error) {
      console.error("Error in declineFollowRequest:", error.message);
      res.status(500).json({ error: error.message });
  }
};

export const getUserProfile = async (req, res) => {
    try {
        const { userId } = req.params;
        const currentUserId = req.user._id;

    
        const user = await User.findById(userId).select("-password");

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

        
        if (user.accountPrivacy === 'private' && !user.followers.includes(currentUserId)) {
            return res.status(200).json({
                username: user.username,
                fullName: user.fullName,
                profileImg: user.profileImg,
                bio: undefined,
                isFollowing: currentUserId ? user.followers.includes(currentUserId) : false,
                accountPrivacy: user.accountPrivacy,
                isPrivate: true,
                followersCount: user.followers.length,
                followingCount: user.following.length
            });
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
            followRequests: isOwnProfile ? user.followRequests : undefined, 
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
       const fileName = generateFileName();
       const params = {
        Bucket: process.env.BUCKET_NAME,
        Key: fileName,
        Body:req.file.buffer,
        ContentType:req.file.mimetype,
      }

      const command = new PutObjectCommand(params);

      await s3.send(command);
      user.fullName = fullName || user.fullName;
      user.username = username || user.username;
      user.email = email || user.email;
      user.profileImg = fileName || user.profileImg;
      user.bio = bio || user.bio;
  
      const updatedUser = await user.save();
  
      return res.status(200).json(updatedUser);
    } catch (error) {
      res.status(500).json({ error: error.message });
      console.log("Error in UpdateUserProfile:", error.message);
    }
  };

