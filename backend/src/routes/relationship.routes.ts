import { Router } from 'express';
import { followUser, listFollowers, listFollowing, unfollowUser } from '../controllers/relationship.controller';
import { authMiddleware, optionalAuthMiddleware } from '../middlewares/auth.middleware';

const router = Router();

router.post('/users/:id/follow', authMiddleware, followUser);
router.delete('/users/:id/follow', authMiddleware, unfollowUser);
router.get('/users/:id/following', optionalAuthMiddleware, listFollowing);
router.get('/users/:id/followers', optionalAuthMiddleware, listFollowers);

export default router;
