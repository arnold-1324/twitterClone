import { limitResource } from "../lib/rateLimits.js";
import express from "express";
import { createPoll, vote, closePoll }from '../controller/poll.controller.js';
import { protectRoute } from "../middleware/protectRoute.js";

const router = express.Router();

router.post("/create", protectRoute, limitResource, createPoll);
router.post("/:messageId/vote", protectRoute, limitResource, vote);
router.patch("/:messageId/close", protectRoute, limitResource, closePoll);

export default router;
