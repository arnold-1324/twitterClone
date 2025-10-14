import express from "express";
import { createPoll, vote, closePoll }from '../controller/poll.controller.js'; 
import { protectRoute } from "../middleware/protectRoute.js";

const router = express.Router();

router.post("/create", protectRoute, createPoll);
router.post("/:messageId/vote", protectRoute, vote);
router.patch("/:messageId/close", protectRoute, closePoll);

export default router;
