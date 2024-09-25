import Notification from "../models/notification.model.js";




export const getNotifications = async (req, res) => {
    try {
        const userId = req.user._id;  

       
        const notifications = await Notification.find({ to: userId })
            .populate('from', 'username profileImg')  
            .populate('post', 'caption') ; 
        
     
        await Notification.updateMany({ to: userId, read: false }, { read: true });

        res.status(200).json(notifications);
    } catch (error) {
        res.status(500).json({ message: "Error fetching notifications", error });
    }
};

export const deleteNotification = async (req, res) => {
    try {
        const { id: notificationId } = req.params;  
        const userId = req.user._id;
        
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

