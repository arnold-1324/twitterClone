import bcrypt from "bcryptjs"; // Ensure this is correctly imported
import { PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3"; // Ensure AWS SDK imports are correct
import User from "../models/User"; // Adjust according to your project structure
import { generateFileName } from "../utils/generateFileName"; // Adjust according to your project structure
import s3 from "../config/s3Config"; // Ensure correct configuration

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