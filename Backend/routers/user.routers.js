import express from "express";
import { upload } from "../lib/utils/uploader.js"

import { protectRoute } from "../middleware/protectRoute.js";
import { getUserProfile ,followUnfollowUser,getSuggestedUser,UpdateUserProfile} from "../controller/user.controller.js";

const router = express.Router();

router.get("/profile/:username",protectRoute,getUserProfile);
router.get("/suggested",protectRoute,getSuggestedUser);
router.post("/follow/:id",protectRoute,followUnfollowUser);
router.post("/update/:id", protectRoute, upload.single('image'), UpdateUserProfile);

export default router;