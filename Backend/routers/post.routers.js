import express from 'express'
import { upload } from "../lib/utils/uploader.js"
import { protectRoute } from "../middleware/protectRoute.js";
import { likePost,addReply,NewPost,EditPost,deletePostsUsersCollection } from '../controller/post.controller.js';
const router=express.Router();

router.post("/NewPost",protectRoute, upload.single('image'),NewPost);
router.post("/EditPost",protectRoute,EditPost);
router.post("/DeletePost",protectRoute);
router.post('/:postId/like',protectRoute, likePost);
router.post('/:postId/reply',protectRoute ,addReply);
router.post('/delete',deletePostsUsersCollection);
export default router;