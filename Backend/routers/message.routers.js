import express from 'express';
import { upload } from "../lib/utils/uploader.js";
import { protectRoute } from "../middleware/protectRoute.js";
import {
    sendMessage,
    getMessages,
    getConversation,
    editMessage,
    replyToMessage,
    deleteMessage
} from '../controller/messageController.js'; 

const router = express.Router();


router.post('/send', protectRoute, upload.single('media'), sendMessage);  //working

router.get('/:otherUserId', protectRoute, getMessages);    //working

router.get("/conversations", protectRoute, getConversation);  

router.put('/edit', protectRoute, editMessage);    //working

router.post('/reply', protectRoute, upload.single('image'), replyToMessage);   //working

//router.put('/deleteforme',protectRoute, deleteFormeMessage); 

router.delete('/deleteforeveryone', protectRoute, deleteMessage);     //working

export default router;
