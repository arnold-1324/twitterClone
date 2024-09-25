import express from 'express'
import { upload } from "../lib/utils/uploader.js"
import { protectRoute } from "../middleware/protectRoute.js";
import { likePost,addReply,NewPost,DeletePost,deletePostsUsersCollection,getFeedPosts,getUserPosts,getPost } from '../controller/post.controller.js';
const router=express.Router();

router.post("/create",protectRoute, upload.single('image'),NewPost); //working
router.put("/like/:id",protectRoute, likePost);   //working
router.put("/reply/:id",protectRoute ,addReply);   //working
router.get("/feed", protectRoute, getFeedPosts);
router.get("/:id", getPost);  //working
router.get("/user/:username", getUserPosts);   //working
//router.delete("/:id",deletePostsUsersCollection);
router.delete("/:id",protectRoute,DeletePost);   //working
export default router;


