import { limitResource, limitUpload } from "../lib/rateLimits.js";
import express from 'express'
import { uploadCarousel, uploadReel } from "../lib/utils/uploader.js"
import { protectRoute } from "../middleware/protectRoute.js";
import { likePost,addReply,NewPost,createReel,recommendations,getSavedIds,listSaved,savePost,listAccountMedia,DeletePost,deletePostsUsersCollection,sharepost,getFeedPosts,getUserPosts,getPost } from '../controller/post.controller.js';
const router=express.Router();

router.post("/create",protectRoute, limitResource, limitUpload, uploadCarousel, NewPost); //working  for both
router.put("/like/:id",protectRoute, limitResource, likePost);   //working    for both
router.put("/reply/:id",protectRoute ,limitResource, addReply);   //working    for both
router.get("/feed", protectRoute, limitResource, getFeedPosts);  //working for both
router.post("/reels", protectRoute, limitResource, limitUpload, uploadReel, createReel);
router.get("/reels", protectRoute, limitResource, recommendations("reel"));
router.get("/discover", protectRoute, limitResource, recommendations("post"));
router.get("/saved/ids", protectRoute, limitResource, getSavedIds);
router.get("/saved", protectRoute, limitResource, listSaved);
router.put("/:id/save", protectRoute, limitResource, savePost);
router.get("/account-media", protectRoute, limitResource, listAccountMedia);
router.get("/:id", limitResource, getPost);  //working for both
router.get("/user/:username", limitResource, getUserPosts);   //working for both

router.post("/sharepost",protectRoute,limitResource, sharepost);
router.delete("/:id",protectRoute,limitResource, DeletePost);   //working   for both
export default router;


