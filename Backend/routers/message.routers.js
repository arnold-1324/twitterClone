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


router.post('/send', protectRoute, upload.single('media'), sendMessage);  // msg encryption works

router.get('/:otherUserId', protectRoute, getMessages);    // msg decryption works

router.get("/conversations", protectRoute, getConversation);  

router.put('/edit', protectRoute, editMessage);    //working

router.post('/reply', protectRoute, upload.single('image'), replyToMessage);   //working

//router.put('/deleteforme',protectRoute, deleteFormeMessage); 

router.delete('/deleteforme', protectRoute, deleteMessage);     //working

export default router;
