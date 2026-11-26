import { limitResource, limitUpload } from "../lib/rateLimits.js";
import { getCallConfig } from "../controller/call.controller.js";
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
router.post('/send', protectRoute, limitResource, limitUpload, upload.single('media'), sendMessage);  // msg encryption works
router.get("/calls/config", protectRoute, limitResource, getCallConfig);
router.get('/:otherUserId', protectRoute, limitResource, getMessages);    // msg decryption works
router.get('/getConvo/user', protectRoute, limitResource, getConversation);  // working but need to work in the resp to the user
router.put('/edit', protectRoute, limitResource, editMessage);    //msg encryption & decryption works
router.post('/reply', protectRoute, limitResource, limitUpload, upload.single('media'), replyToMessage);   //msg encryption & decrytion works
router.put('/reaction', protectRoute,limitResource, reactTomsg);
router.put('/deleteforme',protectRoute, limitResource, deleteMessage);

// Group message routes
router.get('/group/:groupId', protectRoute, limitResource, getGroupMessages);
router.post('/group/send', protectRoute, limitResource, limitUpload, upload.single('media'), sendGroupMessage);
router.get('/group/:groupId/info', protectRoute, limitResource, getGroupConversationInfo);

export default router;
