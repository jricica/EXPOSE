import { SocialRelationshipItem } from '../src/config/dynamo';
import {
  DynamoKey,
  DynamoSocialRelationshipRepository,
  RelationshipDynamoGateway,
} from '../src/repositories/social-relationship.dynamo.repository';

class FakeRelationshipDynamoGateway implements RelationshipDynamoGateway {
  private readonly data = new Map<string, SocialRelationshipItem>();

  async get(_tableName: string, key: DynamoKey): Promise<SocialRelationshipItem | null> {
    return this.data.get(this.identity(key.pk, key.sk)) ?? null;
  }

  async put(_tableName: string, item: SocialRelationshipItem): Promise<void> {
    this.data.set(this.identity(item.pk, item.sk), item);
  }

  async queryByPk(_tableName: string, pk: string): Promise<SocialRelationshipItem[]> {
    return Array.from(this.data.values()).filter((item) => item.pk === pk);
  }

  async queryByGsi1Pk(_tableName: string, gsi1pk: string): Promise<SocialRelationshipItem[]> {
    return Array.from(this.data.values()).filter((item) => item.gsi1pk === gsi1pk);
  }

  private identity(pk: string, sk: string) {
    return `${pk}|${sk}`;
  }
}

describe('DynamoSocialRelationshipRepository', () => {
  let repository: DynamoSocialRelationshipRepository;

  beforeEach(() => {
    repository = new DynamoSocialRelationshipRepository(new FakeRelationshipDynamoGateway());
  });

  it('supports idempotent follow and follower listing', async () => {
    const first = await repository.follow(1, 2);
    const second = await repository.follow(1, 2);

    expect(first.outcome).toBe('created');
    expect(second.outcome).toBe('unchanged');

    const following = await repository.listFollowing(1);
    const followers = await repository.listFollowers(2);

    expect(following).toHaveLength(1);
    expect(followers).toHaveLength(1);
    expect(following[0].relationshipType).toBe('FOLLOW');
  });

  it('blocks in one direction and cleans follow/mute in both directions', async () => {
    await repository.follow(1, 2);
    await repository.mute(1, 2);
    await repository.follow(2, 1);
    await repository.mute(2, 1);

    const blocked = await repository.block(1, 2);
    const reverseState = await repository.getState(2, 1);

    expect(blocked.outcome).toBe('created');
    expect(reverseState.follow).toBe('REMOVED');
    expect(reverseState.mute).toBe('REMOVED');
    expect(await repository.isBlocked(2, 1)).toBe(true);
  });

  it('returns blocked outcome for follow and mute when any direction has block', async () => {
    await repository.block(2, 1);

    const followResult = await repository.follow(1, 2);
    const muteResult = await repository.mute(1, 2);

    expect(followResult.outcome).toBe('blocked');
    expect(muteResult.outcome).toBe('blocked');
    expect(followResult.relationship).toBeNull();
    expect(muteResult.relationship).toBeNull();
  });

  it('keeps getState and summarize consistent with reverse-direction block', async () => {
    await repository.block(9, 3);

    const state = await repository.getState(3, 9);
    const summary = await repository.summarize(3, 9);

    expect(state.isBlocked).toBe(true);
    expect(summary.isBlocked).toBe(true);
    expect(await repository.isBlocked(3, 9)).toBe(true);
  });

  it('validates self-relationships', async () => {
    await expect(repository.follow(7, 7)).rejects.toThrow('sourceUserId and targetUserId must be different');
  });
});