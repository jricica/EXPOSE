import { RelationshipType, UserId, UserRelationship } from '../models/user.model';
import { relationshipRepository, RelationshipRepository } from '../repositories/relationship.repository';

export class RelationshipService {
  constructor(private readonly repo: RelationshipRepository = relationshipRepository) {}

  async follow(userId: UserId, targetUserId: UserId, relationshipType: RelationshipType = 'follow'): Promise<UserRelationship> {
    if (userId === targetUserId) {
      throw new Error('No puedes seguirte a ti mismo');
    }
    return this.repo.follow(userId, targetUserId, relationshipType);
  }

  async unfollow(userId: UserId, targetUserId: UserId): Promise<void> {
    await this.repo.unfollow(userId, targetUserId);
  }

  async listFollowing(userId: UserId): Promise<UserRelationship[]> {
    return this.repo.listFollowing(userId);
  }

  async listFollowers(userId: UserId): Promise<UserRelationship[]> {
    return this.repo.listFollowers(userId);
  }

  async isFollowing(userId: UserId, targetUserId: UserId): Promise<boolean> {
    return this.repo.isFollowing(userId, targetUserId);
  }
}

export const relationshipService = new RelationshipService();
