import express from "express";
import { signUp, Login, Logout ,verifyEmail,forgotPassword,ResetPassword } from "../controller/auth.controller.js";


const router=express.Router();

router.post("/signup",signUp);

router.post("/login",Login);

router.post("/logout",Logout);

router.post("/verify-email",verifyEmail);

router.post("/forgot-password",forgotPassword)

router.post("/reset-password/:resetToken",ResetPassword)



export default router;