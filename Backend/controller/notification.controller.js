import Notification from "../models/notification.model.js";
import mongoose from "mongoose";
import { presentProfile } from "../lib/utils/presentProfile.js";
import { getIO, getRecipientRoom } from "../socket/socket.js";

export const getNotifications = async (req, res) => {
    try {
        const userId = req.user._id;  

       
        const notifications = await Notification.find({ to: userId })
            .sort({ createdAt: -1 }).limit(100).maxTimeMS(2500)
            .populate('from', 'username profileImg')  
            .populate('post', 'caption') ; 
        
     
        if (req.query.markRead !== "false") {
            const unreadIds = notifications.filter(({ read }) => !read).map(({ _id }) => _id);
            if (unreadIds.length) {
                await Notification.updateMany({ _id: { $in: unreadIds }, to: userId }, { read: true });
            }
        }

        const rows = await Promise.all(notifications.map(async (item) => {
            if (!item.from) return item;
            const row = item.toObject();
            return { ...row, from: await presentProfile(row.from) };
        }));
        res.status(200).json(rows);
    } catch (error) {
        res.status(500).json({ message: "Error fetching notifications" });
    }
};


export const deleteNotification = async (req, res, next) => {
    try {
        const { notificationId } = req.body;
        if (!mongoose.isObjectIdOrHexString(notificationId)) {
            return res.status(400).json({ error: "Choose a valid notification." });
        }
        const result = await Notification.deleteOne({ _id: notificationId, to: req.user._id });
        if (!result.deletedCount) return res.status(404).json({ error: "Notification not found." });
        getIO()?.to(getRecipientRoom(req.user._id)).emit("activityChanged");
        return res.json({ message: "Notification deleted" });
    } catch (error) {
        return next(error);
    }
};





export async function markNotificationsRead(req, res, next) {
    try {
        const result = await Notification.updateMany({ to: req.user._id, read: false }, { $set: { read: true } });
        if (result.modifiedCount) getIO()?.to(getRecipientRoom(req.user._id)).emit("activityChanged");
        return res.sendStatus(204);
    } catch (error) {
        return next(error);
    }
}
