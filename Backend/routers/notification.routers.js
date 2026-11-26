import { limitResource } from "../lib/rateLimits.js";
import express from "express"
import { protectRoute } from "../middleware/protectRoute.js";
import { getNotifications,deleteNotification,markNotificationsRead } from "../controller/notification.controller.js";

const router = express.Router();

router.get('/', protectRoute ,limitResource, getNotifications);  //working

router.patch("/read", protectRoute, limitResource, markNotificationsRead);
router.delete("/delete",protectRoute, limitResource, deleteNotification);  //working



export default router;






