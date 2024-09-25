import express from "express"
import { protectRoute } from "../middleware/protectRoute.js";
import { getNotifications,deleteNotification,deleteAllNotifications } from "../controller/notification.controller.js";

const router = express.Router();

router.get('/', protectRoute ,getNotifications);  //working

router.delete("/:id",protectRoute, deleteNotification);

router.delete("/delete-all", protectRoute ,deleteAllNotifications);

export default router;




