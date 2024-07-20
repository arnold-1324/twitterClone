import express from 'express'
import { protectRoute } from "../middleware/protectRoute.js";
import { likePost,addReply,NewPost,EditPost } from '../controller/post.controller.js';
const router=express.Router();

router.post("/NewPost",protectRoute,NewPost);
router.post("/EditPost",protectRoute,EditPost);
router.post("/DeletePost",protectRoute);
router.post('/:postId/like',protectRoute, likePost);
router.post('/:postId/reply',protectRoute ,addReply);

export default router;