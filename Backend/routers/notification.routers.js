import express from "express"
import { protectRoute } from "../middleware/protectRoute.js";
import { getNotifications,deleteNotification,deleteAllNotifications } from "../controller/notification.controller.js";

const router = express.Router();

router.get('/', protectRoute ,getNotifications);

router.delete('/notifications/delete',protectRoute, deleteNotification);

router.delete('/notifications/delete-all', protectRoute ,deleteAllNotifications);

export default router;




