import Notification from "../models/notification.model.js";
import { GetObjectCommand } from "@aws-sdk/client-s3"
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { s3 } from "../lib/utils/uploader.js";


export const getNotifications = async (req, res) => {
    try {
        const userId = req.user._id;  

       
        const notifications = await Notification.find({ to: userId })
            .populate('from', 'username profileImg')  
            .populate('post', 'caption')  
        for (let notification of notifications) {
            if (notification.from.profileImg) {
                const getObjectParams = {
                    Bucket: process.env.BUCKET_NAME,
                    Key: notification.from.profileImg,
                };
                const command = new GetObjectCommand(getObjectParams);
                const url = await getSignedUrl(s3, command, { expiresIn: 3600 });
                notification.from.profileImg = url;
            }
        }

     
        await Notification.updateMany({ to: userId, read: false }, { read: true });

        res.status(200).json(notifications);
    } catch (error) {
        res.status(500).json({ message: "Error fetching notifications", error });
    }
};

export const deleteNotification = async (req, res) => {
    try {
        const { notificationId } = req.body;  

        if (notificationId) {
            await Notification.findByIdAndDelete(notificationId);
            res.status(200).json({ message: "Notification deleted" });
        } else {
            res.status(400).json({ message: "Notification ID is required to delete a notification" });
        }
    } catch (error) {
        res.status(500).json({ message: "Error deleting notification", error });
    }
};

export const deleteAllNotifications = async (req, res) => {
    try {
        const userId = req.user._id;  

        await Notification.deleteMany({ to: userId });

        res.status(200).json({ message: "All notifications deleted" });
    } catch (error) {
        res.status(500).json({ message: "Error deleting all notifications", error });
    }
};

