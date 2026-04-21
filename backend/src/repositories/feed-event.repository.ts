import { randomUUID } from 'crypto';
import {
  buildFeedEventItem,
  FeedEntityType,
  FeedEventItem,
  FeedEventType,
} from '../config/dynamo';

export type FeedVisibility = 'PUBLIC' | 'FOLLOWERS' | 'PRIVATE';

export interface FeedEventCreateInput {
  feedUserId: number;
  actorUserId: number;
  eventType: FeedEventType;
  entityType: FeedEntityType;
  entityId: string;
  parentEntityId?: string;
  payload?: Record<string, unknown>;
  visibility?: FeedVisibility;
  createdAt?: string;
  ttl?: number;
  eventId?: string;
  dedupeKey?: string;
}

export interface FeedPageQuery {
  limit?: number;
  cursor?: string;
  visibility?: FeedVisibility[];
}

export interface FeedCursor {
  lastPk: string;
  lastSk: string;
}

export interface FeedPageResult {
  items: FeedEventItem[];
  nextCursor: string | null;
}

const DEFAULT_PAGE_LIMIT = 20;
const MAX_PAGE_LIMIT = 100;
const FEED_VISIBILITIES: FeedVisibility[] = ['PUBLIC', 'FOLLOWERS', 'PRIVATE'];
const FEED_EVENT_TYPES: FeedEventType[] = [
  'POST_CREATED',
  'POST_LIKED',
  'POST_COMMENTED',
  'POST_SHARED',
  'FOLLOWED_USER',
  'UNFOLLOWED_USER',
];
const FEED_ENTITY_TYPES: FeedEntityType[] = ['POST', 'USER', 'COMMENT', 'SHARE'];

const nowIso = () => new Date().toISOString();

const entityIndexKey = (entityType: FeedEntityType, entityId: string) => `${entityType}:${entityId}`;

const identityKey = (item: Pick<FeedEventItem, 'pk' | 'sk'>) => `${item.pk}|${item.sk}`;

const compareBySortKeyDesc = (a: FeedEventItem, b: FeedEventItem) => {
  const bySk = b.sk.localeCompare(a.sk);
  if (bySk !== 0) {
    return bySk;
  }

  return b.pk.localeCompare(a.pk);
};

const validatePositiveInteger = (name: string, value: number) => {
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${name} must be a positive integer`);
  }
};

const validateLimit = (limit?: number) => {
  if (limit === undefined) return DEFAULT_PAGE_LIMIT;
  if (!Number.isInteger(limit) || limit <= 0 || limit > MAX_PAGE_LIMIT) {
    throw new Error(`limit must be an integer between 1 and ${MAX_PAGE_LIMIT}`);
  }
  return limit;
};

const validateVisibility = (value: unknown, path: string): FeedVisibility => {
  if (typeof value !== 'string' || !FEED_VISIBILITIES.includes(value as FeedVisibility)) {
    throw new Error(`${path} must be one of: ${FEED_VISIBILITIES.join(', ')}`);
  }
  return value as FeedVisibility;
};

const validateVisibilityQuery = (values?: FeedVisibility[]) => {
  if (!values) return undefined;
  return values.map((value, index) => validateVisibility(value, `visibility[${index}]`));
};

const validateEventType = (value: unknown): FeedEventType => {
  if (typeof value !== 'string' || !FEED_EVENT_TYPES.includes(value as FeedEventType)) {
    throw new Error(`eventType must be one of: ${FEED_EVENT_TYPES.join(', ')}`);
  }

  return value as FeedEventType;
};

const validateEntityType = (value: unknown, path = 'entityType'): FeedEntityType => {
  if (typeof value !== 'string' || !FEED_ENTITY_TYPES.includes(value as FeedEntityType)) {
    throw new Error(`${path} must be one of: ${FEED_ENTITY_TYPES.join(', ')}`);
  }

  return value as FeedEntityType;
};

const normalizeStringId = (value: string, fieldName: string) => {
  const normalized = value.trim();
  if (!normalized) {
    throw new Error(`${fieldName} is required`);
  }
  return normalized;
};

const normalizeIsoDate = (value?: string) => {
  if (value === undefined) {
    return nowIso();
  }

  const normalized = value.trim();
  if (!normalized) {
    throw new Error('createdAt must be a valid ISO-8601 string');
  }

  const strictIsoUtcPattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/;
  if (!strictIsoUtcPattern.test(normalized)) {
    throw new Error('createdAt must be a strict ISO-8601 UTC string');
  }

  const timestamp = Date.parse(normalized);
  if (Number.isNaN(timestamp)) {
    throw new Error('createdAt must be a valid ISO-8601 string');
  }

  return new Date(timestamp).toISOString();
};

const normalizeOptionalDedupeKey = (value?: string) => {
  if (value === undefined) {
    return undefined;
  }

  const normalized = value.trim();
  if (!normalized) {
    throw new Error('dedupeKey cannot be empty when provided');
  }

  return normalized;
};

const normalizeEventId = (value?: string) => {
  if (value === undefined) {
    return randomUUID();
  }

  const normalized = value.trim();
  if (!normalized) {
    throw new Error('eventId cannot be empty when provided');
  }

  if (normalized.length > 128) {
    throw new Error('eventId cannot exceed 128 characters');
  }

  if (!/^[A-Za-z0-9:_-]+$/.test(normalized)) {
    throw new Error('eventId contains invalid characters');
  }

  return normalized;
};

const validateTtl = (value?: number) => {
  if (value === undefined) {
    return undefined;
  }

  if (!Number.isInteger(value) || value <= 0) {
    throw new Error('ttl must be a positive integer when provided');
  }

  return value;
};

const clonePayload = <T>(value: T): T => structuredClone(value);

const encodeCursor = (cursor: FeedCursor) => Buffer.from(JSON.stringify(cursor), 'utf8').toString('base64url');

const decodeCursor = (cursor: string): FeedCursor => {
  try {
    const decoded = Buffer.from(cursor, 'base64url').toString('utf8');
    const parsed = JSON.parse(decoded) as FeedCursor;
    if (
      !parsed
      || typeof parsed.lastPk !== 'string'
      || !parsed.lastPk
      || typeof parsed.lastSk !== 'string'
      || !parsed.lastSk
    ) {
      throw new Error('Invalid cursor payload');
    }
    return parsed;
  } catch {
    throw new Error('Invalid cursor');
  }
};

class InMemoryFeedEventStore {
  private readonly events = new Map<string, FeedEventItem>();
  private readonly byFeedUser = new Map<number, Set<string>>();
  private readonly byActor = new Map<number, Set<string>>();
  private readonly byEntity = new Map<string, Set<string>>();
  private readonly byBusinessDedupe = new Map<string, string>();
  private readonly byIdentityDedupe = new Map<string, Set<string>>();

  private attach(index: Map<string | number, Set<string>>, key: string | number, identity: string) {
    const bucket = index.get(key) ?? new Set<string>();
    bucket.add(identity);
    index.set(key, bucket);
  }

  private attachIdentityDedupe(identity: string, dedupeKey: string) {
    const bucket = this.byIdentityDedupe.get(identity) ?? new Set<string>();
    bucket.add(dedupeKey);
    this.byIdentityDedupe.set(identity, bucket);
  }

  private detachSingleIdentityDedupe(identity: string, dedupeKey: string) {
    const bucket = this.byIdentityDedupe.get(identity);
    if (!bucket) return;

    bucket.delete(dedupeKey);
    if (bucket.size === 0) {
      this.byIdentityDedupe.delete(identity);
    }
  }

  private detachIdentityDedupe(identity: string) {
    const bucket = this.byIdentityDedupe.get(identity);
    if (!bucket) return;

    for (const dedupeKey of bucket) {
      const mappedIdentity = this.byBusinessDedupe.get(dedupeKey);
      if (mappedIdentity === identity) {
        this.byBusinessDedupe.delete(dedupeKey);
      }
    }

    this.byIdentityDedupe.delete(identity);
  }

  private detach(index: Map<string | number, Set<string>>, key: string | number, identity: string) {
    const bucket = index.get(key);
    if (!bucket) return;

    bucket.delete(identity);
    if (bucket.size === 0) {
      index.delete(key);
    }
  }

  getByIdentity(identity: string): FeedEventItem | null {
    return this.events.get(identity) ?? null;
  }

  getByBusinessDedupe(dedupeKey: string): FeedEventItem | null {
    const identity = this.byBusinessDedupe.get(dedupeKey);
    if (!identity) {
      return null;
    }

    return this.getByIdentity(identity);
  }

  upsert(item: FeedEventItem, dedupeKey?: string): FeedEventItem {
    const identity = identityKey(item);
    const previous = this.events.get(identity);

    if (previous) {
      this.detachIdentityDedupe(identity);
      this.detach(this.byFeedUser, previous.feedUserId, identity);
      this.detach(this.byActor, previous.actorUserId, identity);
      this.detach(this.byEntity, entityIndexKey(previous.entityType, previous.entityId), identity);
    }

    this.events.set(identity, item);
    this.attach(this.byFeedUser, item.feedUserId, identity);
    this.attach(this.byActor, item.actorUserId, identity);
    this.attach(this.byEntity, entityIndexKey(item.entityType, item.entityId), identity);

    if (dedupeKey) {
      const previousIdentity = this.byBusinessDedupe.get(dedupeKey);
      if (previousIdentity && previousIdentity !== identity) {
        this.detachSingleIdentityDedupe(previousIdentity, dedupeKey);
      }

      this.byBusinessDedupe.set(dedupeKey, identity);
      this.attachIdentityDedupe(identity, dedupeKey);
    }

    return item;
  }

  listByFeedUser(feedUserId: number): FeedEventItem[] {
    const identities = this.byFeedUser.get(feedUserId) ?? new Set<string>();
    return Array.from(identities)
      .map((key) => this.events.get(key))
      .filter((item): item is FeedEventItem => Boolean(item));
  }

  listByActor(actorUserId: number): FeedEventItem[] {
    const identities = this.byActor.get(actorUserId) ?? new Set<string>();
    return Array.from(identities)
      .map((key) => this.events.get(key))
      .filter((item): item is FeedEventItem => Boolean(item));
  }

  listByEntity(entityType: FeedEntityType, entityId: string): FeedEventItem[] {
    const identities = this.byEntity.get(entityIndexKey(entityType, entityId)) ?? new Set<string>();
    return Array.from(identities)
      .map((key) => this.events.get(key))
      .filter((item): item is FeedEventItem => Boolean(item));
  }
}

export class FeedEventRepository {
  constructor(private readonly store = new InMemoryFeedEventStore()) {}

  private page(items: FeedEventItem[], query: FeedPageQuery): FeedPageResult {
    const limit = validateLimit(query.limit);
    const visibility = validateVisibilityQuery(query.visibility);

    const sorted = [...items]
      .sort(compareBySortKeyDesc)
      .filter((item) => !visibility || visibility.includes(item.visibility));

    let start = 0;
    if (query.cursor) {
      const cursor = decodeCursor(query.cursor);
      const index = sorted.findIndex((item) => item.sk === cursor.lastSk && item.pk === cursor.lastPk);
      if (index >= 0) {
        start = index + 1;
      } else {
        const fallbackIndex = sorted.findIndex(
          (item) => item.sk < cursor.lastSk || (item.sk === cursor.lastSk && item.pk < cursor.lastPk),
        );
        start = fallbackIndex >= 0 ? fallbackIndex : sorted.length;
      }
    }

    const pageItems = sorted.slice(start, start + limit);
    const hasNext = start + limit < sorted.length;
    const nextCursor = hasNext && pageItems.length > 0
      ? encodeCursor({
        lastPk: pageItems[pageItems.length - 1].pk,
        lastSk: pageItems[pageItems.length - 1].sk,
      })
      : null;

    return {
      items: pageItems,
      nextCursor,
    };
  }

  async createEvent(input: FeedEventCreateInput): Promise<FeedEventItem> {
    validatePositiveInteger('feedUserId', input.feedUserId);
    validatePositiveInteger('actorUserId', input.actorUserId);

    const entityId = normalizeStringId(input.entityId, 'entityId');
    const parentEntityId = input.parentEntityId ? normalizeStringId(input.parentEntityId, 'parentEntityId') : undefined;
    const createdAt = normalizeIsoDate(input.createdAt);
    const visibility = validateVisibility(input.visibility ?? 'PUBLIC', 'visibility');
    const dedupeKey = normalizeOptionalDedupeKey(input.dedupeKey);
    const ttl = validateTtl(input.ttl);
    const eventType = validateEventType(input.eventType);
    const entityType = validateEntityType(input.entityType);
    const eventId = normalizeEventId(input.eventId);

    if (dedupeKey) {
      const existing = this.store.getByBusinessDedupe(dedupeKey);
      if (existing) {
        return existing;
      }
    }

    const item = buildFeedEventItem(
      {
        feedUserId: input.feedUserId,
        actorUserId: input.actorUserId,
        eventType,
        entityType,
        entityId,
        parentEntityId,
        payload: clonePayload(input.payload ?? {}),
        visibility,
        createdAt,
        ttl,
      },
      eventId,
    );

    return this.store.upsert(item, dedupeKey);
  }

  async getTimeline(feedUserId: number, query: FeedPageQuery = {}): Promise<FeedPageResult> {
    validatePositiveInteger('feedUserId', feedUserId);
    return this.page(this.store.listByFeedUser(feedUserId), query);
  }

  async getActorActivity(actorUserId: number, query: FeedPageQuery = {}): Promise<FeedPageResult> {
    validatePositiveInteger('actorUserId', actorUserId);
    return this.page(this.store.listByActor(actorUserId), query);
  }

  async getEntityActivity(entityType: FeedEntityType, entityId: string, query: FeedPageQuery = {}): Promise<FeedPageResult> {
    const validatedEntityType = validateEntityType(entityType, 'entityType');
    const normalizedEntityId = normalizeStringId(entityId, 'entityId');

    return this.page(this.store.listByEntity(validatedEntityType, normalizedEntityId), query);
  }
}

export const feedEventRepository = new FeedEventRepository();