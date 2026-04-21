import * as followRepository from '../repositories/follow.repository';

export const follow = async (followerId: number, followingId: number) => {
  if (followerId === followingId) {
    throw new Error('You cant follow yourself');
  }

  return await followRepository.followUser(followerId, followingId);
};

export const unfollow = async (followerId: number, followingId: number) => {
  return await followRepository.unfollowUser(followerId, followingId);
};