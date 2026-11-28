import { limitResource, limitUpload } from "../lib/rateLimits.js";
import { getCallConfig } from "../controller/call.controller.js";
import express from 'express';
import { uploadMessageMedia, uploadPostImage, validateImageBytes } from "../lib/utils/uploader.js";
import { protectRoute } from "../middleware/protectRoute.js";
import {
    sendMessage,
    getMessages,
    getConversation,
    getUnreadMessages,
    markMessagesRead,
    setConversationTheme,
    setConversationPreference,
    updateLiveLocation,
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
router.post('/send', protectRoute, limitResource, limitUpload, uploadMessageMedia, sendMessage);  // msg encryption works
router.get("/calls/config", protectRoute, limitResource, getCallConfig);
router.get("/unread", protectRoute, limitResource, getUnreadMessages);
router.get('/:otherUserId', protectRoute, limitResource, getMessages);    // msg decryption works
router.get('/getConvo/user', protectRoute, limitResource, getConversation);  // working but need to work in the resp to the user
router.patch("/:conversationId/theme", protectRoute, limitResource, limitUpload,
    uploadPostImage.single("background"), validateImageBytes, setConversationTheme);
router.patch("/:conversationId/preference", protectRoute, limitResource, setConversationPreference);
router.patch("/:conversationId/read", protectRoute, limitResource, markMessagesRead);
router.patch("/location/:messageId", protectRoute, limitResource, updateLiveLocation);
router.put('/edit', protectRoute, limitResource, editMessage);    //msg encryption & decryption works
router.post('/reply', protectRoute, limitResource, limitUpload, uploadMessageMedia, replyToMessage);   //msg encryption & decrytion works
router.put('/reaction', protectRoute,limitResource, reactTomsg);
router.put('/deleteforme',protectRoute, limitResource, deleteMessage);

// Group message routes
router.get('/group/:groupId', protectRoute, limitResource, getGroupMessages);
router.post('/group/send', protectRoute, limitResource, limitUpload, uploadMessageMedia, sendGroupMessage);
router.get('/group/:groupId/info', protectRoute, limitResource, getGroupConversationInfo);

export default router;
