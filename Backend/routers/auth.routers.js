import express from "express";
import { signUp, Login, Logout ,verifyEmail,forgotPassword,ResetPassword } from "../controller/auth.controller.js";
import rateLimit from "express-rate-limit";
import {  } from "../RateLimitter/RateLimitter.js";

const router=express.Router();

const LogInLimiter=rateLimit({
    windowMs:24*60*60*1000,
    max:3,
    keyGenerator:req=>req.ip || req.user?.id,
    handler:(req,res)=>{
        return res.status(429).json({
            status:"fail",
            message:"Too many requests from this IP, please try again tomorrow",
        })
    }
});


router.post("/signup",signUp);

router.post("/login",Login);

router.post("/logout",Logout);

router.post("/verify-email",verifyEmail);

router.post("/forgot-password",forgotPassword);

router.post("/reset-password/:resetToken",ResetPassword)



export default router;