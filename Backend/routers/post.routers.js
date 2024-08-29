import express from 'express'
import { protectRoute } from "../middleware/protectRoute.js";
import { likePost,addReply,NewPost,DeletePost,deletePostsUsersCollection } from '../controller/post.controller.js';
const router=express.Router();

router.post("/NewPost",protectRoute,NewPost);
router.post('/:postId/like',protectRoute, likePost);
router.post('/:postId/reply',protectRoute ,addReply);
router.post('/delete',deletePostsUsersCollection);
router.post('/:postId/deletepost',protectRoute,DeletePost);
export default router;