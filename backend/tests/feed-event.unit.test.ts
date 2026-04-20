import { FeedEventRepository } from '../src/repositories/feed-event.repository';

describe('FeedEventRepository', () => {
  let repository: FeedEventRepository;

  beforeEach(() => {
    repository = new FeedEventRepository();
  });

  it('stores events ordered by recency in timeline', async () => {
    await repository.createEvent({
      feedUserId: 10,
      actorUserId: 1,
      eventType: 'POST_CREATED',
      entityType: 'POST',
      entityId: 'p1',
      createdAt: '2026-04-19T10:00:00.000Z',
    });

    await repository.createEvent({
      feedUserId: 10,
      actorUserId: 2,
      eventType: 'POST_LIKED',
      entityType: 'POST',
      entityId: 'p2',
      createdAt: '2026-04-19T10:05:00.000Z',
    });

    const timeline = await repository.getTimeline(10);

    expect(timeline.items).toHaveLength(2);
    expect(timeline.items[0].entityId).toBe('p2');
    expect(timeline.items[1].entityId).toBe('p1');
  });

  it('paginates timeline with cursor', async () => {
    const createdAt = [
      '2026-04-19T10:00:00.000Z',
      '2026-04-19T10:01:00.000Z',
      '2026-04-19T10:02:00.000Z',
    ];

    for (let i = 0; i < createdAt.length; i += 1) {
      await repository.createEvent({
        feedUserId: 10,
        actorUserId: i + 1,
        eventType: 'POST_CREATED',
        entityType: 'POST',
        entityId: `p${i}`,
        createdAt: createdAt[i],
      });
    }

    const firstPage = await repository.getTimeline(10, { limit: 2 });
    expect(firstPage.items).toHaveLength(2);
    expect(firstPage.nextCursor).not.toBeNull();
    expect(firstPage.items[0].entityId).toBe('p2');
    expect(firstPage.items[1].entityId).toBe('p1');

    const secondPage = await repository.getTimeline(10, {
      limit: 2,
      cursor: firstPage.nextCursor!,
    });

    expect(secondPage.items).toHaveLength(1);
    expect(secondPage.items[0].entityId).toBe('p0');
    expect(secondPage.nextCursor).toBeNull();
  });

  it('is idempotent when caller reuses the same event id and createdAt', async () => {
    const first = await repository.createEvent({
      feedUserId: 99,
      actorUserId: 8,
      eventType: 'POST_SHARED',
      entityType: 'POST',
      entityId: 'shared-1',
      eventId: 'evt-fixed',
      createdAt: '2026-04-19T12:00:00.000Z',
    });

    const second = await repository.createEvent({
      feedUserId: 99,
      actorUserId: 8,
      eventType: 'POST_SHARED',
      entityType: 'POST',
      entityId: 'shared-1',
      eventId: 'evt-fixed',
      createdAt: '2026-04-19T12:00:00.000Z',
      payload: { changed: true },
    });

    const timeline = await repository.getTimeline(99);

    expect(identity(first)).toBe(identity(second));
    expect(second.payload).toEqual({ changed: true });
    expect(timeline.items).toHaveLength(1);
  });

  it('supports actor and entity activity queries with efficient indexes', async () => {
    await repository.createEvent({
      feedUserId: 1,
      actorUserId: 5,
      eventType: 'POST_CREATED',
      entityType: 'POST',
      entityId: 'post-123',
      createdAt: '2026-04-19T09:00:00.000Z',
    });

    await repository.createEvent({
      feedUserId: 2,
      actorUserId: 5,
      eventType: 'POST_COMMENTED',
      entityType: 'POST',
      entityId: 'post-123',
      createdAt: '2026-04-19T09:02:00.000Z',
    });

    const actorActivity = await repository.getActorActivity(5);
    const entityActivity = await repository.getEntityActivity('POST', 'post-123');

    expect(actorActivity.items).toHaveLength(2);
    expect(entityActivity.items).toHaveLength(2);
    expect(actorActivity.items[0].createdAt).toBe('2026-04-19T09:02:00.000Z');
    expect(entityActivity.items[0].createdAt).toBe('2026-04-19T09:02:00.000Z');
  });

  it('validates visibility in create and query inputs', async () => {
    await expect(
      repository.createEvent({
        feedUserId: 1,
        actorUserId: 1,
        eventType: 'POST_CREATED',
        entityType: 'POST',
        entityId: 'x',
        visibility: 'INVALID' as any,
      }),
    ).rejects.toThrow('visibility must be one of');

    await repository.createEvent({
      feedUserId: 1,
      actorUserId: 1,
      eventType: 'POST_CREATED',
      entityType: 'POST',
      entityId: 'x',
      visibility: 'PUBLIC',
    });

    await expect(
      repository.getTimeline(1, {
        visibility: ['PUBLIC', 'INVALID' as any],
      }),
    ).rejects.toThrow('visibility[1] must be one of');
  });

  it('normalizes entityId and validates createdAt as ISO', async () => {
    await repository.createEvent({
      feedUserId: 2,
      actorUserId: 2,
      eventType: 'POST_CREATED',
      entityType: 'POST',
      entityId: ' post-xyz ',
      createdAt: '2026-04-19T13:00:00.000Z',
    });

    const entityActivity = await repository.getEntityActivity('POST', 'post-xyz');
    expect(entityActivity.items).toHaveLength(1);

    await expect(
      repository.createEvent({
        feedUserId: 2,
        actorUserId: 2,
        eventType: 'POST_CREATED',
        entityType: 'POST',
        entityId: 'bad-date',
        createdAt: 'not-a-date',
      }),
    ).rejects.toThrow('createdAt must be a valid ISO-8601 string');
  });

  it('uses cursor identity (pk+sk) to avoid ambiguity across partitions', async () => {
    await repository.createEvent({
      feedUserId: 10,
      actorUserId: 55,
      eventType: 'POST_CREATED',
      entityType: 'POST',
      entityId: 'a',
      eventId: 'shared-id',
      createdAt: '2026-04-19T11:00:00.000Z',
    });

    await repository.createEvent({
      feedUserId: 11,
      actorUserId: 55,
      eventType: 'POST_LIKED',
      entityType: 'POST',
      entityId: 'b',
      eventId: 'shared-id',
      createdAt: '2026-04-19T11:00:00.000Z',
    });

    await repository.createEvent({
      feedUserId: 12,
      actorUserId: 55,
      eventType: 'POST_COMMENTED',
      entityType: 'POST',
      entityId: 'c',
      createdAt: '2026-04-19T11:01:00.000Z',
    });

    const firstPage = await repository.getActorActivity(55, { limit: 2 });
    expect(firstPage.items).toHaveLength(2);
    expect(firstPage.nextCursor).not.toBeNull();

    const secondPage = await repository.getActorActivity(55, {
      limit: 2,
      cursor: firstPage.nextCursor!,
    });

    expect(secondPage.items).toHaveLength(1);
  });

  it('supports business dedupe with dedupeKey', async () => {
    const first = await repository.createEvent({
      feedUserId: 15,
      actorUserId: 7,
      eventType: 'POST_LIKED',
      entityType: 'POST',
      entityId: 'post-1',
      dedupeKey: 'like:7:post-1',
    });

    const second = await repository.createEvent({
      feedUserId: 15,
      actorUserId: 7,
      eventType: 'POST_LIKED',
      entityType: 'POST',
      entityId: 'post-1',
      dedupeKey: 'like:7:post-1',
    });

    const timeline = await repository.getTimeline(15);
    expect(identity(first)).toBe(identity(second));
    expect(timeline.items).toHaveLength(1);
  });
});

const identity = (item: { pk: string; sk: string }) => `${item.pk}|${item.sk}`;