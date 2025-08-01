import User from "../models/user.model.js";
import Post from "../models/post.model.js";
import Notification from "../models/notification.model.js";
import bcrypt from "bcryptjs";
import { PutObjectCommand,DeleteObjectCommand } from "@aws-sdk/client-s3"
import { s3,generateFileName } from "../lib/utils/uploader.js";
import mongoose from "mongoose";


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







// export const getUserProfile = async (req, res) => {
//     try {
//         const { username } = req.params;
//        // const currentUserId = req.user._id;

      
    
//         const user = await User.findById(username).select("-password");

//         if (!user) {
//             return res.status(404).json({ error: "User not found" });
//         }

//         return res.status(200).json({
//             username: user.username,
//             fullName: user.fullName,
//             bio: user.bio,
//             profileImg: user.profileImg,
//             followersCount: user.followers.length,
//             followingCount: user.following.length,

//         });

//     } catch (error) {
//         console.error("Error in getUserProfile:", error.message);
//         res.status(500).json({ error: "Internal Server Error" });
//     }
// };

export const getUserProfile = async (req, res) => {
  const { query } = req.params;  
  try {
      let user;

      if (mongoose.Types.ObjectId.isValid(query)) {
          user = await User.findOne({ _id: query }).select("-password -updatedAt -verificationToken -verificationTokenExpiresAt");
      } else {
          user = await User.findOne({ username: query }).select("-password -updatedAt -verificationToken -verificationTokenExpiresAt");
      }

      if (!user) return res.status(404).json({ error: "User not found" });

      return res.status(200).json(user);

  } catch (error) {
      console.error("Error in getUserProfile:", error.message);
      res.status(500).json({ error: "Internal Server Error" });
  }
};



export const getSuggestedUser = async (req, res) => {

  try {
    const userId = req.user._id;

    const { following } = await User.findById(userId).select('following');

    const directSet = new Set(following.map((f) => f.toString()));

    const layer2 = new Set();
    for (const friendId of directSet) {
      const { following: theirFollows } = await User
        .findById(friendId)
        .select('following');
      theirFollows.forEach(f => layer2.add(f.toString()));
    }

    layer2.delete(userId);
    for (const id of directSet) {
      layer2.delete(id);
    }

    const suggestedUser = Array.from(layer2).slice(0, 5);
    const users = await User.find({ _id: { $in: suggestedUser } }).select('-password -updatedAt -verificationToken -verificationTokenExpiresAt');

    console.log("suggestedUser:", users);



    res.status(200).json(users);
  } catch (error) {
    res.status(500).json({ error: error.message });
    console.log("Error in suggestedUser:", error.message);
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
          Key: user.profileImg.split('/').pop()
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
      
      
      const publicUrl = `https://${process.env.BUCKET_NAME}.s3.${process.env.REGION}.amazonaws.com/${fileName}`;
      user.profileImg = publicUrl; 
    }

    user.fullName = fullName || user.fullName;
    user.username = username || user.username;
    user.email = email || user.email;
    user.bio = bio || user.bio;

    const updatedUser = await user.save();

    await Post.updateMany(
			{ "replies.userId": userId },
			{
				$set: {
					"replies.$[reply].username": user.username,
					"replies.$[reply].profileImg": user.profileImg,
				},
			},
			{ arrayFilters: [{ "reply.userId": userId }] }
		);

    return res.status(200).json(updatedUser);
  } catch (error) {
    console.error("Error in UpdateUserProfile:", error.message);
    return res.status(500).json({ error: error.message });
  }
};

// export const UpdateUserProfile = async (req, res) => {
  
//     try {
//       const { fullName, username, email, currentPassword, newPassword, bio } = req.body;
//       const userId = req.user._id;
  
//       const user = await User.findById(userId);
//       if (!user) {
//         return res.status(404).json({ message: "User not found" });
//       }
  
//       if (req.params.id && req.params.id !== userId.toString()) {
//         return res.status(400).json({ error: "You cannot update another user's profile" });
//       }
  
//       if ((newPassword && !currentPassword) || (!newPassword && currentPassword)) {
//         return res.status(400).json({ error: "Please provide both current password and new password" });
//       }
  
//       if (currentPassword && newPassword) {
//         const isMatch = await bcrypt.compare(currentPassword, user.password);
//         if (!isMatch) {
//           return res.status(400).json({ error: "Current password is incorrect" });
//         }
//         if (newPassword.length < 6) {
//           return res.status(400).json({ error: "Password must be at least 6 characters long" });
//         }
//         const salt = await bcrypt.genSalt(10);
//         user.password = await bcrypt.hash(newPassword, salt);
//       }
  
//       let fileName = user.profileImg || "";
  
//       if (req.file) {
//         if (user.profileImg) {
//           const deleteParams = {
//             Bucket: process.env.BUCKET_NAME,
//             Key: user.profileImg,
//           };
  
//           const deleteCommand = new DeleteObjectCommand(deleteParams);
//           await s3.send(deleteCommand);
//           console.log("Deleted old profile image:", deleteParams.Key);
//         }
  
//         fileName = generateFileName();
//         const uploadParams = {
//           Bucket: process.env.BUCKET_NAME,
//           Key: fileName,
//           Body: req.file.buffer,
//           ContentType: req.file.mimetype,
//         };
  
//         const uploadCommand = new PutObjectCommand(uploadParams);
//         await s3.send(uploadCommand);
//         console.log("Uploaded new profile image:", fileName);
//       }
  
//       user.fullName = fullName || user.fullName;
//       user.username = username || user.username;
//       user.email = email || user.email;
//       user.profileImg = fileName;
//       user.bio = bio || user.bio;
  
//       const updatedUser = await user.save();

//       const getObjectParams = {
//                 Bucket: process.env.BUCKET_NAME,
//                 Key: updatedUser.profileImg,
//             };
//             const command = new GetObjectCommand(getObjectParams);
//             const url = await getSignedUrl(s3, command, { expiresIn: 3600 });
//             updatedUser.profileImg = url;
  
//       return res.status(200).json(updatedUser);
//     } catch (error) {
//       console.error("Error in UpdateUserProfile:", error.message);
//       return res.status(500).json({ error: error.message });
//     }
//   };