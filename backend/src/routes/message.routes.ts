import { Router } from 'express';
import {
	createDirectConversation,
  deleteConversationMessage,
  editConversationMessage,
	listConversationMessages,
	listConversations,
	listMessages,
	markConversationRead,
	sendConversationMessage,
	sendMessage,
} from '../controllers/message.controller';
import { authMiddleware } from '../middlewares/auth.middleware';
import { validateConversationOwnership } from '../middlewares/validateConversationOwnership.middleware';

const router = Router();

router.post('/conversations', authMiddleware, createDirectConversation);
router.post('/conversations/direct', authMiddleware, createDirectConversation);
router.get('/conversations', authMiddleware, listConversations);
router.get('/conversations/:conversationId', authMiddleware, validateConversationOwnership, listConversationMessages);
router.post('/conversations/:conversationId', authMiddleware, validateConversationOwnership, sendConversationMessage);
router.get('/conversations/:conversationId/messages', authMiddleware, validateConversationOwnership, listConversationMessages);
router.post('/conversations/:conversationId/messages', authMiddleware, validateConversationOwnership, sendConversationMessage);
router.patch('/conversations/:conversationId/messages/:messageId', authMiddleware, validateConversationOwnership, editConversationMessage);
router.delete('/conversations/:conversationId/messages/:messageId', authMiddleware, validateConversationOwnership, deleteConversationMessage);
router.post('/conversations/:conversationId/read', authMiddleware, validateConversationOwnership, markConversationRead);

router.post('/', authMiddleware, sendMessage);
router.get('/', authMiddleware, listMessages);

export default router;
