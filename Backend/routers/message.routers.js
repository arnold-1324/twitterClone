import express from 'express';
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


router.post('/send', protectRoute, sendMessage);

router.get('/:otherUserId', protectRoute, getMessages);

router.get('/conversations', protectRoute, getConversation);

router.put('/edit', protectRoute, editMessage);

router.post('/reply', protectRoute, replyToMessage);

router.delete('/delete', protectRoute, deleteMessage);

export default router;
