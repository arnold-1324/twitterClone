import express from "express"
import { protectRoute } from "../middleware/protectRoute";
import { getNotifications,deleteNotification,deleteAllNotifications } from "../controller/notification.controller";

const router = express.Router();

router.get('/', protectRoute ,getNotifications);

router.delete('/notifications/delete',protectRoute, deleteNotification);

router.delete('/notifications/delete-all', protectRoute ,deleteAllNotifications);

export default router;




