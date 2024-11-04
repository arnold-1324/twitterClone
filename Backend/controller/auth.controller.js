import User from "../models/user.model.js";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { s3 } from '../lib/utils/uploader.js'
import { generateTokenAndCookies } from "../lib/utils/generateToken.js";
import { sendResetPasswordEmail, sendVerificationEmail,sendWelcomeEmail,sendPasswordResetSuccessEmail } from "../lib/utils/Mailtrap/email.js"
import { profile } from "console";


export const signUp=async(req,res)=>{
  try {
    const {fullName,username,email,password,confirmPassword}=req.body;
 
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

    if(password!=confirmPassword)return res.status(400).json({ Error:"Password doest match"});

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
    const verificationToken = Math.floor(100000+ Math.random()*900000).toString();
    const newUser= new User({
        fullName,
        username,
        email,
        password:hashedPassword,
        verificationToken,
        verificationTokenExpiresAt:Date.now()+24*60*60*1000
    })

    if(newUser){
      generateTokenAndCookies(newUser._id,res);
      await newUser.save();  
      //await sendVerificationEmail(newUser.email,verificationToken);  

      res.status(201).json({
        sucess:true,
        message: "User created sucessfully",
        user: {
          ...newUser._doc,
          password: undefined,
          verificationToken: undefined,
          verificationTokenExpiresAt: undefined,
        },
      })
    }else{
        res.status(400).json({ error:"Invalid user data"});
    }


  } catch (Error) {
    console.log("Error in Signup controller",error.message);
    res.status(500).json({Error:"Internal Server Error"});

  }
}

export const Login= async(req,res)=>{
  
try{
  const {username,password} =req.body;
  const user=await User.findOne({username});
  const isPassword=await bcrypt.compare(password,user?.password || "");

  if(!user || !isPassword) return res.json({error:"Invalid username or password"})


    generateTokenAndCookies(user._id,res);

    res.status(201).json({
      sucess:true,
      message: "login  sucessfully",
      user: {
        ...user._doc,
        password: undefined,
        verificationToken: undefined,
        verificationTokenExpiresAt: undefined,
      },

    })

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


export const verifyEmail = async(req,res)=>{
 const { verificationCode } = req.body;
 try{
const user = await User.findOne({
  verificationToken:verificationCode,
  verificationTokenExpiresAt: { $gt:Date.now()}
})

if(!user){
  return res.status(400).json({sucess:false,message:"Invalid or expired verification code"})
}
user.isVerified = true;
user.verificationToken=undefined;
user.verificationTokenExpiresAt=undefined;
await user.save();

//await sendWelcomeEmail(user.email,user.fullName);
res.status(200).json({
  success:true,
  message:"Email verified successfully",
  user: {
    ...user._doc,
    password: undefined,
    verificationToken: undefined,
    verificationTokenExpiresAt: undefined,
  },
})
 }catch(error){
  console.log("Error in verifyEmail controller",error.message);
  res.status(500).json({error:"Internal Server Error"});
 } 
}

export const forgotPassword = async(req,res)=>{
  const { Femail } = req.body;
  try{
    const user = await User.findOne({Femail});
    if(!user){
      return res.status(400).json({ success:true, message:"User not found"});
    }

    const resetToken = crypto.randomBytes(20).toString("hex");
    const resetTokenExpiresAt=Date.now() + 1*60*60*1000;

    user.resetPasswordToken=resetToken;
    user.resetPasswordExpires=resetTokenExpiresAt;

    await user.save();
    //await sendResetPasswordEmail(user.email,`${process.env.CLIENT_URL}reset-password/${resetToken}`);

    res.status(200).json({ sucess:true,message:"Password reset link send to your email",
      // user: {
      //   ...newUser._doc,
      //   password: undefined,
      //   verificationToken: undefined,
      //   verificationTokenExpiresAt: undefined,
      // },
  });

  }catch(error){
    console.log("Error in forgotPassword controller",error.message);
  res.status(500).json({error:"Internal Server Error"});
  }
}

export const ResetPassword = async (req, res) => {
  const { resetToken } = req.params;
  const { password, confirmPassword } = req.body;

  try {
    
    if (password !== confirmPassword) {
      return res.status(400).json({ success: false, error: "Passwords do not match" });
    }


    const user = await User.findOne({
      resetPasswordToken: resetToken,
      resetPasswordExpires: { $gt: Date.now() }
    });


    if (!user) {
      return res.status(400).json({ success: false, message: "Invalid or expired reset token" });
    }


    const salt = await bcrypt.genSalt(10);
    const NewhashedPassword = await bcrypt.hash(password, salt);

  
    user.password = NewhashedPassword;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;


    await user.save();


    await sendPasswordResetSuccessEmail(user.email);

   
    return res.status(200).json({ success: true, message: "Password has been reset successfully" });

  } catch (error) {

    console.log("Error in ResetPassword controller", error.message);
    return res.status(500).json({ success: false, error: "Internal Server Error" });
  }
};



