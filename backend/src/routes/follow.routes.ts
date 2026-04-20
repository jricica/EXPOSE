import { Router } from 'express';
import { followUser, unfollowUser } from '../controllers/follow.controller';
import { authMiddleware } from '../middlewares/auth.middleware';

const router = Router();

router.post('/:userId', authMiddleware, followUser);
router.delete('/:userId', authMiddleware, unfollowUser);

export default router;