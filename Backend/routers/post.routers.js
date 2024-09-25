import express from 'express'
import { upload } from "../lib/utils/uploader.js"
import { protectRoute } from "../middleware/protectRoute.js";
import { likePost,addReply,NewPost,DeletePost,deletePostsUsersCollection,getFeedPosts,getUserPosts,getPost } from '../controller/post.controller.js';
const router=express.Router();

router.post("/create",protectRoute, upload.single('image'),NewPost);
router.put("/like/:id",protectRoute, likePost);
router.put("/reply/:id",protectRoute ,addReply);
router.get("/feed", protectRoute, getFeedPosts);
router.get("/:id", getPost);
router.get("/user/:username", getUserPosts);
//router.delete("/:id",deletePostsUsersCollection);
router.post('/:postId/deletepost',protectRoute,DeletePost);
export default router;


