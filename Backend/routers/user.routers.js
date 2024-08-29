import express from "express";


import { protectRoute } from "../middleware/protectRoute.js";
import { getUserProfile ,followUnfollowUser,getSuggestedUser,UpdateUserProfile,} from "../controller/user.controller.js";

const router = express.Router();

router.get("/profile/:userId?",protectRoute,getUserProfile);
router.get("/suggested",protectRoute,getSuggestedUser);
router.post("/follow/:id",protectRoute,followUnfollowUser);
router.post("/update/:id", protectRoute, UpdateUserProfile);

export default router;