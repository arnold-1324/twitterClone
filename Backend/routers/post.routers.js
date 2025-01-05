import express from 'express'
import { upload } from "../lib/utils/uploader.js"
import { protectRoute } from "../middleware/protectRoute.js";
import { likePost,addReply,NewPost,DeletePost,deletePostsUsersCollection,sharepost,getFeedPosts,getUserPosts,getPost } from '../controller/post.controller.js';
const router=express.Router();

router.post("/create",protectRoute, upload.single('image'),NewPost); //working  for both
router.put("/like/:id",protectRoute, likePost);   //working    for both
router.put("/reply/:id",protectRoute ,addReply);   //working    for both
router.get("/feed", protectRoute, getFeedPosts);  //working for both
router.get("/:id", getPost);  //working for both
router.get("/user/:username", getUserPosts);   //working for both
//router.delete("/deleteAll",deletePostsUsersCollection);
router.post("/sharepost",protectRoute,sharepost);
router.delete("/:id",protectRoute,DeletePost);   //working   for both
export default router;


