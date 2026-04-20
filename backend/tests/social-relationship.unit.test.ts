import { SocialRelationshipRepository } from '../src/repositories/social-relationship.repository';

describe('SocialRelationshipRepository', () => {
  let repository: SocialRelationshipRepository;

  beforeEach(() => {
    repository = new SocialRelationshipRepository();
  });

  it('creates follow relationships idempotently', async () => {
    const first = await repository.follow(1, 2);
    const second = await repository.follow(1, 2);

    expect(first.outcome).toBe('created');
    expect(first.relationship?.relationshipType).toBe('FOLLOW');
    expect(first.relationship?.status).toBe('ACTIVE');
    expect(second.outcome).toBe('unchanged');
    expect(second.relationship?.updatedAt).toBe(first.relationship?.updatedAt);

    const following = await repository.listFollowing(1);
    const followers = await repository.listFollowers(2);

    expect(following).toHaveLength(1);
    expect(followers).toHaveLength(1);
    expect(await repository.isFollowing(1, 2)).toBe(true);
  });

  it('marks follow as removed on unfollow and keeps the operation idempotent', async () => {
    await repository.follow(1, 2);

    const removed = await repository.unfollow(1, 2);
    const removedAgain = await repository.unfollow(1, 2);

    expect(removed.outcome).toBe('removed');
    expect(removed.relationship?.status).toBe('REMOVED');
    expect(removedAgain.outcome).toBe('unchanged');
    expect(removedAgain.relationship).toBeNull();
    expect(await repository.isFollowing(1, 2)).toBe(false);
    expect(await repository.listFollowing(1)).toHaveLength(0);
  });

  it('blocks a user and removes follow and mute state', async () => {
    await repository.follow(1, 2);
    await repository.mute(1, 2);

    const blocked = await repository.block(1, 2);
    const state = await repository.getState(1, 2);

    expect(blocked.outcome).toBe('created');
    expect(blocked.relationship?.relationshipType).toBe('BLOCK');
    expect(blocked.relationship?.status).toBe('ACTIVE');
    expect(state.follow).toBe('REMOVED');
    expect(state.mute).toBe('REMOVED');
    expect(state.block).toBe('ACTIVE');
    expect(await repository.isBlocked(1, 2)).toBe(true);
    expect(await repository.listBlocked(1)).toHaveLength(1);
  });

  it('mutes a user unless the target is blocked', async () => {
    const muted = await repository.mute(1, 2);
    expect(muted.outcome).toBe('created');
    expect(muted.relationship?.relationshipType).toBe('MUTE');
    expect(muted.relationship?.status).toBe('ACTIVE');

    const blocked = await repository.block(1, 2);
    const mutedAfterBlock = await repository.mute(1, 2);

    expect(blocked.relationship?.relationshipType).toBe('BLOCK');
    expect(mutedAfterBlock.outcome).toBe('blocked');
    expect(mutedAfterBlock.relationship).toBeNull();
    expect(await repository.isMuted(1, 2)).toBe(false);
    expect(await repository.listMuted(1)).toHaveLength(0);
  });

  it('unblocks and unmutes independently', async () => {
    await repository.block(1, 2);
    await repository.mute(1, 3);

    const unblocked = await repository.unblock(1, 2);
    const unmuted = await repository.unmute(1, 3);

    expect(unblocked.outcome).toBe('removed');
    expect(unblocked.relationship?.status).toBe('REMOVED');
    expect(unmuted.outcome).toBe('removed');
    expect(unmuted.relationship?.status).toBe('REMOVED');
    expect(await repository.isBlocked(1, 2)).toBe(false);
    expect(await repository.isMuted(1, 3)).toBe(false);
  });

  it('validates that users cannot target themselves', async () => {
    await expect(repository.follow(1, 1)).rejects.toThrow('sourceUserId and targetUserId must be different');
    await expect(repository.block(2, 2)).rejects.toThrow('sourceUserId and targetUserId must be different');
  });

  it('cleans up reciprocal follow and mute relationships when blocking', async () => {
    await repository.follow(2, 1);
    await repository.mute(2, 1);
    await repository.follow(1, 2);
    await repository.mute(1, 2);

    const blocked = await repository.block(1, 2);
    const reverseState = await repository.getState(2, 1);

    expect(blocked.outcome).toBe('created');
    expect(blocked.relationship?.status).toBe('ACTIVE');
    expect(reverseState.follow).toBe('REMOVED');
    expect(reverseState.mute).toBe('REMOVED');
    expect(reverseState.block).toBe('NONE');
    expect(reverseState.isFollowing).toBe(false);
    expect(reverseState.isMuted).toBe(false);
  });

  it('reports reverse-direction blocks consistently in getState and isBlocked', async () => {
    await repository.block(2, 1);

    const state = await repository.getState(1, 2);

    expect(await repository.isBlocked(1, 2)).toBe(true);
    expect(state.isBlocked).toBe(true);
    expect(state.block).toBe('NONE');
    expect(state.follow).toBe('NONE');
    expect(state.mute).toBe('NONE');
  });
});