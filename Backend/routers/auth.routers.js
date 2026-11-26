import { limitResource } from "../lib/rateLimits.js";
import { protectRoute } from "../middleware/protectRoute.js";
import express from "express";
import { signUp, Login, Logout ,verifyEmail,forgotPassword,ResetPassword,refreshSession } from "../controller/auth.controller.js";
const router = express.Router();

router.post("/signup", limitResource, signUp);
router.post("/login", limitResource, Login);
router.get("/session", protectRoute, limitResource, (_req, res) => res.sendStatus(204));
router.post("/refresh", limitResource, refreshSession);
router.post("/logout",limitResource, Logout);

router.post("/verify-email",limitResource, verifyEmail);

router.post("/forgot-password",limitResource, forgotPassword);

router.post("/reset-password/:resetToken", limitResource, ResetPassword)



export default router;
