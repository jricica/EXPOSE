import { del, get, post } from '../../../services/api';

export type UserRelationship = {
  userId: number;
  targetUserId: number;
  relationshipType: 'follow' | 'blocked' | 'friend';
  createdAt: string;
};

export const relationshipService = {
  async listFollowing(userId: number): Promise<UserRelationship[]> {
    return get<UserRelationship[]>(`/relationships/users/${userId}/following`);
  },

  async listFollowers(userId: number): Promise<UserRelationship[]> {
    return get<UserRelationship[]>(`/relationships/users/${userId}/followers`);
  },

  async follow(userId: number): Promise<UserRelationship> {
    return post<UserRelationship>(`/relationships/users/${userId}/follow`);
  },

  async unfollow(userId: number): Promise<void> {
    await del<void>(`/relationships/users/${userId}/follow`);
  },
};
