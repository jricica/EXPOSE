import {
  buildRelationshipItem,
  DYNAMO_PREFIXES,
  DYNAMO_TABLES,
  RelationshipType,
  SocialRelationshipItem,
} from '../config/dynamo';
import type {
  RelationshipMutationResult,
  RelationshipSummary,
  RelationshipState,
  SocialRelationshipAction,
  RelationshipMutationOutcome,
  RelationshipItemState,
} from './social-relationship.repository';

export interface DynamoKey {
  pk: string;
  sk: string;
}

export interface RelationshipDynamoGateway {
  get(tableName: string, key: DynamoKey): Promise<SocialRelationshipItem | null>;
  put(tableName: string, item: SocialRelationshipItem): Promise<void>;
  queryByPk(tableName: string, pk: string): Promise<SocialRelationshipItem[]>;
  queryByGsi1Pk(tableName: string, gsi1pk: string): Promise<SocialRelationshipItem[]>;
}

const nowIso = () => new Date().toISOString();

const userKey = (userId: number) => `${DYNAMO_PREFIXES.user}#${userId}`;

const relationshipSk = (targetUserId: number, relationshipType: RelationshipType) =>
  `${DYNAMO_PREFIXES.relationship}#${relationshipType}#${targetUserId}`;

const relationshipKey = (sourceUserId: number, targetUserId: number, relationshipType: RelationshipType): DynamoKey => ({
  pk: userKey(sourceUserId),
  sk: relationshipSk(targetUserId, relationshipType),
});

const isValidIsoUtc = (value: string) => /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/.test(value);

const toItemState = (item: SocialRelationshipItem | null): RelationshipItemState => {
  if (!item) {
    return 'NONE';
  }

  return item.status;
};

export class DynamoSocialRelationshipRepository {
  constructor(
    private readonly gateway: RelationshipDynamoGateway,
    private readonly tableName = DYNAMO_TABLES.socialRelationships,
    private readonly clock = nowIso,
  ) {}

  private assertValidUsers(sourceUserId: number, targetUserId: number) {
    if (!Number.isInteger(sourceUserId) || !Number.isInteger(targetUserId)) {
      throw new Error('sourceUserId and targetUserId must be integers');
    }

    if (sourceUserId <= 0 || targetUserId <= 0) {
      throw new Error('sourceUserId and targetUserId must be positive');
    }

    if (sourceUserId === targetUserId) {
      throw new Error('sourceUserId and targetUserId must be different');
    }
  }

  private assertValidUserId(userId: number) {
    if (!Number.isInteger(userId) || userId <= 0) {
      throw new Error('userId must be a positive integer');
    }
  }

  private async getRelationship(sourceUserId: number, targetUserId: number, relationshipType: RelationshipType) {
    return this.gateway.get(this.tableName, relationshipKey(sourceUserId, targetUserId, relationshipType));
  }

  private async upsertRelationship(
    sourceUserId: number,
    targetUserId: number,
    relationshipType: RelationshipType,
    status: 'ACTIVE' | 'REMOVED',
    existing?: SocialRelationshipItem | null,
  ) {
    const current = existing ?? await this.getRelationship(sourceUserId, targetUserId, relationshipType);
    if (current && current.status === status) {
      return current;
    }

    const now = this.clock();
    if (!isValidIsoUtc(now)) {
      throw new Error('clock() must return a valid ISO-8601 UTC timestamp');
    }

    const item = buildRelationshipItem({
      sourceUserId,
      targetUserId,
      relationshipType,
      status,
      createdAt: current?.createdAt ?? now,
      updatedAt: now,
    });

    await this.gateway.put(this.tableName, item);
    return item;
  }

  private async removeRelationship(sourceUserId: number, targetUserId: number, relationshipType: RelationshipType) {
    const existing = await this.getRelationship(sourceUserId, targetUserId, relationshipType);
    return this.removeRelationshipFromExisting(sourceUserId, targetUserId, relationshipType, existing);
  }

  private async removeRelationshipFromExisting(
    sourceUserId: number,
    targetUserId: number,
    relationshipType: RelationshipType,
    existing: SocialRelationshipItem | null,
  ) {
    if (!existing || existing.status === 'REMOVED') {
      return null;
    }

    return this.upsertRelationship(sourceUserId, targetUserId, relationshipType, 'REMOVED', existing);
  }

  private async snapshot(sourceUserId: number, targetUserId: number) {
    const [follow, block, mute, reverseBlock] = await Promise.all([
      this.getRelationship(sourceUserId, targetUserId, 'FOLLOW'),
      this.getRelationship(sourceUserId, targetUserId, 'BLOCK'),
      this.getRelationship(sourceUserId, targetUserId, 'MUTE'),
      this.getRelationship(targetUserId, sourceUserId, 'BLOCK'),
    ]);

    return {
      follow,
      block,
      mute,
      reverseBlock,
    };
  }

  private async toState(sourceUserId: number, targetUserId: number): Promise<RelationshipState> {
    const current = await this.snapshot(sourceUserId, targetUserId);
    const isBlocked = current.block?.status === 'ACTIVE' || current.reverseBlock?.status === 'ACTIVE';

    return {
      sourceUserId,
      targetUserId,
      follow: toItemState(current.follow),
      block: toItemState(current.block),
      mute: toItemState(current.mute),
      isFollowing: current.follow?.status === 'ACTIVE',
      isBlocked,
      isMuted: current.mute?.status === 'ACTIVE',
    };
  }

  private async buildResult(
    action: SocialRelationshipAction,
    outcome: RelationshipMutationOutcome,
    sourceUserId: number,
    targetUserId: number,
    relationship: SocialRelationshipItem | null,
    reason?: string,
  ): Promise<RelationshipMutationResult> {
    return {
      action,
      outcome,
      relationship,
      state: await this.toState(sourceUserId, targetUserId),
      reason,
    };
  }

  async follow(sourceUserId: number, targetUserId: number): Promise<RelationshipMutationResult> {
    this.assertValidUsers(sourceUserId, targetUserId);

    const current = await this.snapshot(sourceUserId, targetUserId);
    const blocked = current.block?.status === 'ACTIVE' || current.reverseBlock?.status === 'ACTIVE';
    if (blocked) {
      return this.buildResult(
        'FOLLOW',
        'blocked',
        sourceUserId,
        targetUserId,
        null,
        'A blocked relationship prevents follow',
      );
    }

    const existing = current.follow;
    if (existing?.status === 'ACTIVE') {
      return this.buildResult('FOLLOW', 'unchanged', sourceUserId, targetUserId, existing);
    }

    const relationship = await this.upsertRelationship(sourceUserId, targetUserId, 'FOLLOW', 'ACTIVE', existing);
    return this.buildResult(
      'FOLLOW',
      existing ? 'updated' : 'created',
      sourceUserId,
      targetUserId,
      relationship,
    );
  }

  async unfollow(sourceUserId: number, targetUserId: number): Promise<RelationshipMutationResult> {
    this.assertValidUsers(sourceUserId, targetUserId);

    const relationship = await this.removeRelationship(sourceUserId, targetUserId, 'FOLLOW');
    return this.buildResult(
      'UNFOLLOW',
      relationship ? 'removed' : 'unchanged',
      sourceUserId,
      targetUserId,
      relationship,
    );
  }

  async block(sourceUserId: number, targetUserId: number): Promise<RelationshipMutationResult> {
    this.assertValidUsers(sourceUserId, targetUserId);

    const [existing, forwardFollow, forwardMute, reverseFollow, reverseMute] = await Promise.all([
      this.getRelationship(sourceUserId, targetUserId, 'BLOCK'),
      this.getRelationship(sourceUserId, targetUserId, 'FOLLOW'),
      this.getRelationship(sourceUserId, targetUserId, 'MUTE'),
      this.getRelationship(targetUserId, sourceUserId, 'FOLLOW'),
      this.getRelationship(targetUserId, sourceUserId, 'MUTE'),
    ]);

    if (existing?.status === 'ACTIVE') {
      return this.buildResult('BLOCK', 'unchanged', sourceUserId, targetUserId, existing);
    }

    await Promise.all([
      this.removeRelationshipFromExisting(sourceUserId, targetUserId, 'FOLLOW', forwardFollow),
      this.removeRelationshipFromExisting(sourceUserId, targetUserId, 'MUTE', forwardMute),
      this.removeRelationshipFromExisting(targetUserId, sourceUserId, 'FOLLOW', reverseFollow),
      this.removeRelationshipFromExisting(targetUserId, sourceUserId, 'MUTE', reverseMute),
    ]);

    const relationship = await this.upsertRelationship(sourceUserId, targetUserId, 'BLOCK', 'ACTIVE', existing);
    return this.buildResult(
      'BLOCK',
      existing ? 'updated' : 'created',
      sourceUserId,
      targetUserId,
      relationship,
    );
  }

  async unblock(sourceUserId: number, targetUserId: number): Promise<RelationshipMutationResult> {
    this.assertValidUsers(sourceUserId, targetUserId);

    const relationship = await this.removeRelationship(sourceUserId, targetUserId, 'BLOCK');
    return this.buildResult(
      'UNBLOCK',
      relationship ? 'removed' : 'unchanged',
      sourceUserId,
      targetUserId,
      relationship,
    );
  }

  async mute(sourceUserId: number, targetUserId: number): Promise<RelationshipMutationResult> {
    this.assertValidUsers(sourceUserId, targetUserId);

    const current = await this.snapshot(sourceUserId, targetUserId);
    const blocked = current.block?.status === 'ACTIVE' || current.reverseBlock?.status === 'ACTIVE';
    if (blocked) {
      return this.buildResult(
        'MUTE',
        'blocked',
        sourceUserId,
        targetUserId,
        null,
        'A blocked relationship prevents mute',
      );
    }

    const existing = current.mute;
    if (existing?.status === 'ACTIVE') {
      return this.buildResult('MUTE', 'unchanged', sourceUserId, targetUserId, existing);
    }

    const relationship = await this.upsertRelationship(sourceUserId, targetUserId, 'MUTE', 'ACTIVE', existing);
    return this.buildResult(
      'MUTE',
      existing ? 'updated' : 'created',
      sourceUserId,
      targetUserId,
      relationship,
    );
  }

  async unmute(sourceUserId: number, targetUserId: number): Promise<RelationshipMutationResult> {
    this.assertValidUsers(sourceUserId, targetUserId);

    const relationship = await this.removeRelationship(sourceUserId, targetUserId, 'MUTE');
    return this.buildResult(
      'UNMUTE',
      relationship ? 'removed' : 'unchanged',
      sourceUserId,
      targetUserId,
      relationship,
    );
  }

  async getState(sourceUserId: number, targetUserId: number): Promise<RelationshipState> {
    this.assertValidUsers(sourceUserId, targetUserId);
    return this.toState(sourceUserId, targetUserId);
  }

  async summarize(sourceUserId: number, targetUserId: number): Promise<RelationshipSummary> {
    this.assertValidUsers(sourceUserId, targetUserId);
    const state = await this.toState(sourceUserId, targetUserId);

    return {
      sourceUserId: state.sourceUserId,
      targetUserId: state.targetUserId,
      isFollowing: state.isFollowing,
      isBlocked: state.isBlocked,
      isMuted: state.isMuted,
    };
  }

  async isFollowing(sourceUserId: number, targetUserId: number): Promise<boolean> {
    this.assertValidUsers(sourceUserId, targetUserId);
    const follow = await this.getRelationship(sourceUserId, targetUserId, 'FOLLOW');
    return follow?.status === 'ACTIVE';
  }

  async isBlocked(sourceUserId: number, targetUserId: number): Promise<boolean> {
    this.assertValidUsers(sourceUserId, targetUserId);
    const current = await this.snapshot(sourceUserId, targetUserId);
    return current.block?.status === 'ACTIVE' || current.reverseBlock?.status === 'ACTIVE';
  }

  async isMuted(sourceUserId: number, targetUserId: number): Promise<boolean> {
    this.assertValidUsers(sourceUserId, targetUserId);
    const mute = await this.getRelationship(sourceUserId, targetUserId, 'MUTE');
    return mute?.status === 'ACTIVE';
  }

  async listFollowing(sourceUserId: number): Promise<SocialRelationshipItem[]> {
    this.assertValidUserId(sourceUserId);
    const items = await this.gateway.queryByPk(this.tableName, userKey(sourceUserId));
    return items.filter((item) => item.relationshipType === 'FOLLOW' && item.status === 'ACTIVE');
  }

  async listFollowers(targetUserId: number): Promise<SocialRelationshipItem[]> {
    this.assertValidUserId(targetUserId);
    const items = await this.gateway.queryByGsi1Pk(this.tableName, userKey(targetUserId));
    return items.filter((item) => item.relationshipType === 'FOLLOW' && item.status === 'ACTIVE');
  }

  async listBlocked(sourceUserId: number): Promise<SocialRelationshipItem[]> {
    this.assertValidUserId(sourceUserId);
    const items = await this.gateway.queryByPk(this.tableName, userKey(sourceUserId));
    return items.filter((item) => item.relationshipType === 'BLOCK' && item.status === 'ACTIVE');
  }

  async listMuted(sourceUserId: number): Promise<SocialRelationshipItem[]> {
    this.assertValidUserId(sourceUserId);
    const items = await this.gateway.queryByPk(this.tableName, userKey(sourceUserId));
    return items.filter((item) => item.relationshipType === 'MUTE' && item.status === 'ACTIVE');
  }
}