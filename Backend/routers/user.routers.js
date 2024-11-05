import express from "express";
import { upload } from "../lib/utils/uploader.js"

import { protectRoute } from "../middleware/protectRoute.js";
import { getUserProfile ,followUnfollowUser,getSuggestedUser,UpdateUserProfile,} from "../controller/user.controller.js";

const router = express.Router();

router.get("/profile/:query",protectRoute,getUserProfile);  //working for both
router.get("/suggested",protectRoute,getSuggestedUser);  //working for both
router.post("/follow/:id",protectRoute,followUnfollowUser);  //working for both
router.put("/update/:id", protectRoute, upload.single('image'), UpdateUserProfile);  //working for both

export default router;