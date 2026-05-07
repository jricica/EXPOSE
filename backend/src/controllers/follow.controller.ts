import { Request, Response } from 'express';
import * as followService from '../services/follow.service';
import { getUserId } from '../utils/auth';

export const followUser = async (req: Request, res: Response) => {
  try {
    const followerId = getUserId(req);
    const followingId = Number(req.params.userId);

    const result = await followService.follow(followerId, followingId);

    res.status(201).json(result);
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
};

export const unfollowUser = async (req: Request, res: Response) => {
  try {
    const followerId = getUserId(req);
    const followingId = Number(req.params.userId);

    await followService.unfollow(followerId, followingId);

    res.status(200).json({ message: 'Unfollowed successfully' });
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
};