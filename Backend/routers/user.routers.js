import { getAccountHistory, setProfilePrivacy } from "../controller/accountHistory.controller.js";
import { limitResource, limitUpload } from "../lib/rateLimits.js";
import express from "express";
import { uploadPostImage, validateImageBytes } from "../lib/utils/uploader.js"

import { protectRoute } from "../middleware/protectRoute.js";
import { getUserProfile ,followUnfollowUser,getSuggestedUser,UpdateUserProfile,searchUsers} from "../controller/user.controller.js";

const router = express.Router();

router.get("/profile/:query",protectRoute,limitResource, getUserProfile);  //working for both
router.get("/account-history", protectRoute, limitResource, getAccountHistory);
router.patch("/profile-privacy", protectRoute, limitResource, setProfilePrivacy);
router.get("/search", protectRoute, limitResource, searchUsers);
router.get("/suggested",protectRoute,limitResource, getSuggestedUser);  //working for both
router.post("/follow/:id",protectRoute,limitResource, followUnfollowUser);  //working for both
router.put("/update/:id", protectRoute, limitResource, limitUpload, uploadPostImage.single('image'), validateImageBytes,  UpdateUserProfile);  //working for both

export default router;
