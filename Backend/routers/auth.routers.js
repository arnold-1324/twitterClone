import express from "express";
import { signUp, Login, Logout } from "../controller/auth.controller.js";


const router=express.Router();

router.post("/signup",signUp);

router.post("/login",Login);

router.post("/logout",Logout);


export default router;