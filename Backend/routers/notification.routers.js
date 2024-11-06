import express from "express"
import { protectRoute } from "../middleware/protectRoute.js";
import { getNotifications,deleteNotification } from "../controller/notification.controller.js";

const router = express.Router();

router.get('/', protectRoute ,getNotifications);  //working

router.delete("/delete",protectRoute, deleteNotification);  //working



export default router;






