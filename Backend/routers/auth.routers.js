import express from "express";
import { signUp, Login, Logout , getUser,PasswordRest,UpdatePassword } from "../controller/auth.controller.js";
import { protectRoute } from "../middleware/protectRoute.js";

const router=express.Router();

router.post("/signup",signUp);

router.post("/login",Login);

router.post("/logout",Logout);

router.post("/password-rest",PasswordRest);

router.post("/updatePassword",UpdatePassword);

router.get("/me",protectRoute,getUser);



export default router;