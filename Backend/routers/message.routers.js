import express from 'express';
import { upload } from "../lib/utils/uploader.js";
import { protectRoute } from "../middleware/protectRoute.js";
import {
    sendMessage,
    getMessages,
    getConversation,
    editMessage,
    replyToMessage,
    deleteMessage,
    reactTomsg,
    getGroupMessages,
    sendGroupMessage,
    getGroupConversationInfo
} from '../controller/messageController.js'; 

const router = express.Router();

// Individual message routes
router.post('/send', protectRoute, upload.single('media'), sendMessage);  // msg encryption works
router.get('/:otherUserId', protectRoute, getMessages);    // msg decryption works
router.get('/getConvo/user', protectRoute, getConversation);  // working but need to work in the resp to the user 
router.put('/edit', protectRoute, editMessage);    //msg encryption & decryption works
router.post('/reply', protectRoute, upload.single('media'), replyToMessage);   //msg encryption & decrytion works
router.put('/reaction', protectRoute,reactTomsg); 
router.put('/deleteforme',protectRoute, deleteMessage); 

// Group message routes
router.get('/group/:groupId', protectRoute, getGroupMessages);
router.post('/group/send', protectRoute, upload.single('media'), sendGroupMessage);
router.get('/group/:groupId/info', protectRoute, getGroupConversationInfo);

export default router;
