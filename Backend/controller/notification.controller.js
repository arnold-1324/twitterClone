import Notification from "../models/notification.model.js";

export const getNotification = async(req,res)=>{
    try{
        const userId =req.user._id;
        const notification = await Notification.find({to:userId}).populate({
            path: from
        })
    }
}