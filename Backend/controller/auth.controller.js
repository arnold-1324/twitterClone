import User from "../models/user.model.js";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import nodemailer from 'nodemailer';
import { generateTokenAndCookies } from "../lib/utils/generateToken.js";

export const signUp=async(req,res)=>{
  try {
    const {fullName,username,email,password}=req.body;
 
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

    if(!emailRegex.test(email)){
        return res.status(400).json({ Error:"Invalid email format"});
    }

    const existingUser= await User.findOne({username});
    if(existingUser){
        return res.status(400).json({ Error:"Username is already taken"});
    }

    const existingEmail= await User.findOne({email});
    if(existingEmail){
        return res.status(400).json({Error:"Email is already taken "})
    }


    const salt= await bcrypt.genSalt(10);
    const hashedPassword= await bcrypt.hash(password,salt);

    const newUser= new User({
        fullName,
        username,
        email,
        password:hashedPassword
    })

    if(newUser){
      generateTokenAndCookies(newUser._id,res);
      await newUser.save();

      res.status(201).json({
        _id:newUser._id,
        fullName: newUser.fullName,
        username:newUser.username,
        email:newUser.email,
        followers: newUser.followers,
        following:newUser.following,
        profileImg:newUser.profileImg,
        coverImg:newUser.coverImg,

      })
    }else{
        res.status(400).json({ error:"Invalid user data"});
    }

  } catch (error) {
    console.log("Error in Signup controller",error.message);
    res.status(500).json({error:"Internal Server Error"});

  }
}

export const Login= async(req,res)=>{
  
try{
  const {username,password} =req.body;
  const user=await User.findOne({username});
  const isPassword=await bcrypt.compare(password,user?.password || "");

  if(!user || !isPassword) return res.json({error:"Invalid username or password"})


    generateTokenAndCookies(user._id,res);

    res.status(200).json({
        _id: user._id,
        fullName: user.fullName,
        username: user.username,
        email:user.email,
        followers: user.followers,
        following:user.following,
        profileImg:user.profileImg,
        coverImg:user.coverImg,
    });

}catch(error){
    console.log("Error in login controller",error.message);
    res.status(500).json({error:"Internal Server Error"});
}
}

export const Logout= async(req,res)=>{

  try{

     res.cookie("jwt","",{maxAge:0})
     res.status(200).json({message:"Logged out successfully"})

  }catch(error){
     console.log("Error in logout controller",error.message);
    res.status(500).json({error:"Internal Server Error"});

  }
}


export const PasswordRest= async(req,res)=>{
    try {
      
      const { email } =req.body;
      const user=await User.findOne({email});
      if(!user) return res.status(400).json({error:"User not found"});

      const token = (bytes=32)=> crypto.randomBytes(bytes).toString('hex');
      user.resetPasswordToken = token;
      user.resetPasswordExpires = Date.now() + 3600000;

      await user.save();
      
      const transpoter = nodemailer.createTransport({
        service:"Gmail",
        auth:{
          user:process.env.EMAILID,
          pass:process.env.EMAILIDPASS
        },
      });

      const mailOptions = {
        to: user.email,
        from: process.env.EMAILID,
        subject: 'Password Reset',
        text: `You are receiving this because you (or someone else) have requested the reset of the password for your account.\n\n
              Please click on the following link, or paste this into your browser to complete the process:\n\n
              http://${req.headers.host}/reset/${token}\n\n
              If you did not request this, please ignore this email and your password will remain unchanged.\n`,
      };

      transpoter.sendMail(mailOptions, (err) => {
        if (err) {
          return res.status(500).send('Error sending email');
        }
        res.status(200).send('Recovery email sent');
      });

 } catch (error) {
  console.log("Error in passwordrest controller",error.message);
    res.status(500).json({error:"Internal Server Error"});
 }
}

export const UpdatePassword = async(req,res)=>{
 try{

  const user = await User.findOne({
    resetPasswordToken: req.params.token,
    resetPasswordExpires: { $gt: Date.now() },
  });

  if (!user) {
    return res.status(400).send('Password reset token is invalid or has expired.');
  }

  const {password} =req.body;
  const salt = await bcrypt.getSalt(10);
  const hashedPassword = await bcrypt.hash(password,salt);

  user.password = hashedPassword;
  user.resetPasswordToken = "";
  user.resetPasswordExpires = undefined;

  await user.save();
  return  res.status(200).send('Password has been reset');

 }catch(error){
  console.log("Error in updatePassword controller",error.message);
  res.status(500).json({error:"Internal Server Error"});

 }
}




export const getUser=async(req,res)=>{

  try{
    const user= await User.findById(req.user._id).select("-password");
    res.status(200).json(user);
  }catch(error){
     console.log("Error in getUser controller",error.message);
    res.status(500).json({error:"Internal Server Error"});

  }
}