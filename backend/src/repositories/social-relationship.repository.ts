import {
  buildRelationshipItem,
  RelationshipStatus,
  RelationshipType,
  SocialRelationshipItem,
} from '../config/dynamo';

export type SocialRelationshipAction =
  | 'FOLLOW'
  | 'UNFOLLOW'
  | 'BLOCK'
  | 'UNBLOCK'
  | 'MUTE'
  | 'UNMUTE';

export type RelationshipItemState = 'NONE' | 'ACTIVE' | 'REMOVED';

export interface RelationshipState {
  sourceUserId: number;
  targetUserId: number;
  follow: RelationshipItemState;
  block: RelationshipItemState;
  mute: RelationshipItemState;
  isFollowing: boolean;
  isBlocked: boolean;
  isMuted: boolean;
}

export interface RelationshipSummary {
  sourceUserId: number;
  targetUserId: number;
  isFollowing: boolean;
  isBlocked: boolean;
  isMuted: boolean;
}

export type RelationshipMutationOutcome = 'created' | 'unchanged' | 'updated' | 'removed' | 'blocked';

export interface RelationshipMutationResult {
  action: SocialRelationshipAction;
  outcome: RelationshipMutationOutcome;
  relationship: SocialRelationshipItem | null;
  state: RelationshipState;
  reason?: string;
}

const nowIso = () => new Date().toISOString();

const createIdentityKey = (sourceUserId: number, targetUserId: number, relationshipType: RelationshipType) =>
  `${sourceUserId}:${targetUserId}:${relationshipType}`;

class InMemorySocialRelationshipStore {
  private readonly items = new Map<string, SocialRelationshipItem>();
  private readonly sourceIndex = new Map<number, Set<string>>();
  private readonly targetIndex = new Map<number, Set<string>>();

  private attachIndex(index: Map<number, Set<string>>, userId: number, key: string) {
    const bucket = index.get(userId) ?? new Set<string>();
    bucket.add(key);
    index.set(userId, bucket);
  }

  private detachIndex(index: Map<number, Set<string>>, userId: number, key: string) {
    const bucket = index.get(userId);
    if (!bucket) return;
    bucket.delete(key);
    if (bucket.size === 0) {
      index.delete(userId);
    }
  }

  upsert(item: SocialRelationshipItem) {
    const key = createIdentityKey(item.sourceUserId, item.targetUserId, item.relationshipType);
    const previous = this.items.get(key);

    if (previous) {
      this.detachIndex(this.sourceIndex, previous.sourceUserId, key);
      this.detachIndex(this.targetIndex, previous.targetUserId, key);
    }

    this.items.set(key, item);
    this.attachIndex(this.sourceIndex, item.sourceUserId, key);
    this.attachIndex(this.targetIndex, item.targetUserId, key);
    return item;
  }

  get(sourceUserId: number, targetUserId: number, relationshipType: RelationshipType) {
    return this.items.get(createIdentityKey(sourceUserId, targetUserId, relationshipType)) ?? null;
  }

  listBySource(sourceUserId: number) {
    const keys = this.sourceIndex.get(sourceUserId) ?? new Set<string>();
    return Array.from(keys)
      .map((key) => this.items.get(key))
      .filter((item): item is SocialRelationshipItem => Boolean(item));
  }

  listByTarget(targetUserId: number) {
    const keys = this.targetIndex.get(targetUserId) ?? new Set<string>();
    return Array.from(keys)
      .map((key) => this.items.get(key))
      .filter((item): item is SocialRelationshipItem => Boolean(item));
  }

  snapshot(sourceUserId: number, targetUserId: number) {
    return {
      follow: this.get(sourceUserId, targetUserId, 'FOLLOW'),
      block: this.get(sourceUserId, targetUserId, 'BLOCK'),
      mute: this.get(sourceUserId, targetUserId, 'MUTE'),
      reverseFollow: this.get(targetUserId, sourceUserId, 'FOLLOW'),
      reverseMute: this.get(targetUserId, sourceUserId, 'MUTE'),
      reverseBlock: this.get(targetUserId, sourceUserId, 'BLOCK'),
    };
  }
}

export class SocialRelationshipRepository {
  constructor(private readonly store = new InMemorySocialRelationshipStore()) {}

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

  private toItemState(item: SocialRelationshipItem | null): RelationshipItemState {
    if (!item) {
      return 'NONE';
    }

    return item.status;
  }

  private toState(sourceUserId: number, targetUserId: number): RelationshipState {
    const snapshot = this.store.snapshot(sourceUserId, targetUserId);
    const isBlocked = snapshot.block?.status === 'ACTIVE' || snapshot.reverseBlock?.status === 'ACTIVE';

    return {
      sourceUserId,
      targetUserId,
      follow: this.toItemState(snapshot.follow),
      block: this.toItemState(snapshot.block),
      mute: this.toItemState(snapshot.mute),
      isFollowing: snapshot.follow?.status === 'ACTIVE',
      isBlocked,
      isMuted: snapshot.mute?.status === 'ACTIVE',
    };
  }

  private buildResult(
    action: SocialRelationshipAction,
    outcome: RelationshipMutationOutcome,
    sourceUserId: number,
    targetUserId: number,
    relationship: SocialRelationshipItem | null,
    reason?: string,
  ): RelationshipMutationResult {
    return {
      action,
      outcome,
      relationship,
      state: this.toState(sourceUserId, targetUserId),
      reason,
    };
  }

  private async upsertRelationship(
    sourceUserId: number,
    targetUserId: number,
    relationshipType: RelationshipType,
    status: RelationshipStatus,
  ) {
    const existing = this.store.get(sourceUserId, targetUserId, relationshipType);

    if (existing && existing.status === status) {
      return existing;
    }

    const now = nowIso();

    const item = buildRelationshipItem({
      sourceUserId,
      targetUserId,
      relationshipType,
      status,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    });

    return this.store.upsert(item);
  }

  private async removeRelationship(
    sourceUserId: number,
    targetUserId: number,
    relationshipType: RelationshipType,
  ) {
    const existing = this.store.get(sourceUserId, targetUserId, relationshipType);
    if (!existing) {
      return null;
    }

    if (existing.status === 'REMOVED') {
      return null;
    }

    return this.upsertRelationship(sourceUserId, targetUserId, relationshipType, 'REMOVED');
  }

  private async blockGuard(sourceUserId: number, targetUserId: number) {
    const snapshot = this.store.snapshot(sourceUserId, targetUserId);
    const activeBlock = [snapshot.block, snapshot.reverseBlock].find((item) => item?.status === 'ACTIVE') ?? null;

    return activeBlock;
  }

  private async removeDirectionalRelationships(
    sourceUserId: number,
    targetUserId: number,
    relationshipTypes: RelationshipType[],
  ) {
    const removals = relationshipTypes.map((type) => this.removeRelationship(sourceUserId, targetUserId, type));
    return Promise.all(removals);
  }

  async follow(sourceUserId: number, targetUserId: number): Promise<RelationshipMutationResult> {
    this.assertValidUsers(sourceUserId, targetUserId);

    const blocked = await this.blockGuard(sourceUserId, targetUserId);
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

    const existing = this.store.get(sourceUserId, targetUserId, 'FOLLOW');
    if (existing?.status === 'ACTIVE') {
      return this.buildResult('FOLLOW', 'unchanged', sourceUserId, targetUserId, existing);
    }

    const relationship = await this.upsertRelationship(sourceUserId, targetUserId, 'FOLLOW', 'ACTIVE');
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

    const existing = this.store.get(sourceUserId, targetUserId, 'BLOCK');
    if (existing?.status === 'ACTIVE') {
      return this.buildResult('BLOCK', 'unchanged', sourceUserId, targetUserId, existing);
    }

    await this.removeDirectionalRelationships(sourceUserId, targetUserId, ['FOLLOW', 'MUTE']);
    await this.removeDirectionalRelationships(targetUserId, sourceUserId, ['FOLLOW', 'MUTE']);

    const relationship = await this.upsertRelationship(sourceUserId, targetUserId, 'BLOCK', 'ACTIVE');
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

    const blocked = await this.blockGuard(sourceUserId, targetUserId);
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

    const existing = this.store.get(sourceUserId, targetUserId, 'MUTE');
    if (existing?.status === 'ACTIVE') {
      return this.buildResult('MUTE', 'unchanged', sourceUserId, targetUserId, existing);
    }

    const relationship = await this.upsertRelationship(sourceUserId, targetUserId, 'MUTE', 'ACTIVE');
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

  async isFollowing(sourceUserId: number, targetUserId: number): Promise<boolean> {
    this.assertValidUsers(sourceUserId, targetUserId);
    const follow = this.store.get(sourceUserId, targetUserId, 'FOLLOW');
    return follow?.status === 'ACTIVE';
  }

  async isBlocked(sourceUserId: number, targetUserId: number): Promise<boolean> {
    this.assertValidUsers(sourceUserId, targetUserId);
    const snapshot = this.store.snapshot(sourceUserId, targetUserId);
    return snapshot.block?.status === 'ACTIVE' || snapshot.reverseBlock?.status === 'ACTIVE';
  }

  async isMuted(sourceUserId: number, targetUserId: number): Promise<boolean> {
    this.assertValidUsers(sourceUserId, targetUserId);
    const mute = this.store.get(sourceUserId, targetUserId, 'MUTE');
    return mute?.status === 'ACTIVE';
  }

  async listFollowing(sourceUserId: number): Promise<SocialRelationshipItem[]> {
    this.assertValidUserId(sourceUserId);
    return this.filterActiveBySource(sourceUserId, 'FOLLOW');
  }

  async listFollowers(targetUserId: number): Promise<SocialRelationshipItem[]> {
    this.assertValidUserId(targetUserId);
    return this.filterActiveByTarget(targetUserId, 'FOLLOW');
  }

  async listBlocked(sourceUserId: number): Promise<SocialRelationshipItem[]> {
    this.assertValidUserId(sourceUserId);
    return this.filterActiveBySource(sourceUserId, 'BLOCK');
  }

  async listMuted(sourceUserId: number): Promise<SocialRelationshipItem[]> {
    this.assertValidUserId(sourceUserId);
    return this.filterActiveBySource(sourceUserId, 'MUTE');
  }

  async summarize(sourceUserId: number, targetUserId: number): Promise<RelationshipSummary> {
    this.assertValidUsers(sourceUserId, targetUserId);
    const state = this.toState(sourceUserId, targetUserId);

    return {
      sourceUserId: state.sourceUserId,
      targetUserId: state.targetUserId,
      isFollowing: state.isFollowing,
      isBlocked: state.isBlocked,
      isMuted: state.isMuted,
    };
  }

  private filterActiveBySource(sourceUserId: number, relationshipType: RelationshipType): SocialRelationshipItem[] {
    return this.store
      .listBySource(sourceUserId)
      .filter((item) => item.relationshipType === relationshipType && item.status === 'ACTIVE');
  }

  private filterActiveByTarget(targetUserId: number, relationshipType: RelationshipType): SocialRelationshipItem[] {
    return this.store
      .listByTarget(targetUserId)
      .filter((item) => item.relationshipType === relationshipType && item.status === 'ACTIVE');
  }
}

export const socialRelationshipRepository = new SocialRelationshipRepository();