import express from "express";
import { signUp, Login, Logout , getUser,verifyEmail,forgotPassword,ResetPassword } from "../controller/auth.controller.js";
import { protectRoute } from "../middleware/protectRoute.js";

const router=express.Router();

router.post("/signup",signUp);

router.post("/login",Login);

router.post("/logout",Logout);

router.post("/verify-email",verifyEmail);

router.post("/forgot-password",forgotPassword)

router.post("/reset-password/:resetToken",ResetPassword)

router.get("/me",protectRoute,getUser);



export default router;