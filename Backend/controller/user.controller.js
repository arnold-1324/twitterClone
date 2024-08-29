import User from "../models/user.model.js";
import Notification from "../models/notification.model.js";
import bcrypt from "bcryptjs";
import Post from "../models/post.model.js"
import { v2 as cloudinary } from "cloudinary";



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
 const { name, email, username, password, bio } = req.body;
let { profileImg } = req.body;

const userId = req.user._id;
try {
  let user = await User.findById(userId);
  if (!user) return res.status(400).json({ error: "User not found" });
console.log(bio);
console.log(profileImg);
  if (req.params.id !== userId.toString())
    return res.status(400).json({ error: "You cannot update other user's profile" });

  if (password) {
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    user.password = hashedPassword;
  }
    console.log(profileImg);
  if (profileImg) {
    if (user.profileImg) {
      await cloudinary.uploader.destroy(user.profileImg.split("/").pop().split(".")[0]);
    }

    const uploadedResponse = await cloudinary.uploader.upload(profileImg);
    profileImg = uploadedResponse.secure_url;
  }

  user.name = name || user.name;
  user.email = email || user.email;
  user.username = username || user.username;
  user.profileImg = profileImg || user.profileImg;
  user.bio = bio || user.bio;
  console.log(bio);

  user = await user.save();

  
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

  
  user.password = null;

  res.status(200).json(user);
} catch (err) {
  res.status(500).json({ error: err.message });
  console.log("Error in updateUser: ", err.message);
}
  };

