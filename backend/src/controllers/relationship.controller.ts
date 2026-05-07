import { Request, Response } from 'express';
import * as Sentry from '@sentry/node';
import { relationshipService } from '../services/relationship.service';
import { getUserId } from '../utils/auth';
import { messageService } from '../services/message.service';

export const followUser = async (req: Request, res: Response) => {
  try {
    const currentUserId = getUserId(req);
    const targetUserId = Number(req.params.id);
    const rel = await relationshipService.follow(currentUserId, targetUserId);
    await messageService.getOrCreateDirectConversation(currentUserId, targetUserId, {
      skipFollowValidation: true,
    });
    res.status(201).json(rel);
  } catch (err) {
    Sentry.captureException(err);
    res.status(400).json({ message: err instanceof Error ? err.message : 'Error al seguir usuario.' });
  }
};

export const unfollowUser = async (req: Request, res: Response) => {
  try {
    const currentUserId = getUserId(req);
    const targetUserId = Number(req.params.id);
    await relationshipService.unfollow(currentUserId, targetUserId);
    res.status(204).send();
  } catch (err) {
    Sentry.captureException(err);
    res.status(400).json({ message: 'Error al dejar de seguir usuario.' });
  }
};

export const listFollowing = async (req: Request, res: Response) => {
  try {
    const userId = Number(req.params.id);
    const result = await relationshipService.listFollowing(userId);
    res.json(result);
  } catch (err) {
    Sentry.captureException(err);
    res.status(500).json({ message: 'Error al obtener following.' });
  }
};

export const listFollowers = async (req: Request, res: Response) => {
  try {
    const userId = Number(req.params.id);
    const result = await relationshipService.listFollowers(userId);
    res.json(result);
  } catch (err) {
    Sentry.captureException(err);
    res.status(500).json({ message: 'Error al obtener followers.' });
  }
};
