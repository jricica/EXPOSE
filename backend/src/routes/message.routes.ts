import { Router } from 'express';
import { listMessages, sendMessage } from '../controllers/message.controller';
import { authMiddleware } from '../middlewares/auth.middleware';

const router = Router();

router.post('/messages', authMiddleware, sendMessage);
router.get('/messages', authMiddleware, listMessages);

export default router;
