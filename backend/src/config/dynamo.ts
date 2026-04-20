import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import dotenv from 'dotenv';

dotenv.config();

const region = process.env.AWS_REGION || 'us-east-1';
const endpoint = process.env.AWS_DYNAMO_ENDPOINT;

const credentials = process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY
  ? {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    }
  : undefined;

const dynamoClient = new DynamoDBClient({
  region,
  endpoint,
  credentials,
});

export const ddbDocClient = DynamoDBDocumentClient.from(dynamoClient, {
  marshallOptions: {
    removeUndefinedValues: true,
    convertClassInstanceToMap: true,
  },
});

export const TABLES = {
  FEED: process.env.DYNAMO_FEED_TABLE || 'FeedItems',
  RELATIONSHIPS: process.env.DYNAMO_REL_TABLE || 'UserRelationships',
  POST_LIKES: process.env.DYNAMO_POST_LIKES_TABLE || 'PostLikes',
  POST_COMMENTS: process.env.DYNAMO_POST_COMMENTS_TABLE || 'PostComments',
  POST_SHARES: process.env.DYNAMO_POST_SHARES_TABLE || 'PostShares',
  MESSAGES: process.env.DYNAMO_MESSAGES_TABLE || 'Messages',
  CONVERSATIONS: process.env.DYNAMO_CONVERSATIONS_TABLE || 'Conversations',
} as const;

export const INDEXES = {
  FEED_USER_CREATED_AT: process.env.DYNAMO_FEED_USER_INDEX || 'UserIdCreatedAtIndex',
  REL_TARGET_USER: process.env.DYNAMO_REL_TARGET_INDEX || 'TargetUserIndex',
} as const;

export const DYNAMO_TABLES = {
  socialRelationships: process.env.DYNAMO_RELATIONSHIPS_TABLE || TABLES.RELATIONSHIPS,
  feedEvents: process.env.DYNAMO_FEED_TABLE || TABLES.FEED,
} as const;

export const DYNAMO_PREFIXES = {
  user: 'USER',
  relationship: 'REL',
  feed: 'FEED',
  event: 'EVT',
  actor: 'ACTOR',
  entity: 'ENTITY',
} as const;

export type RelationshipType = 'FOLLOW' | 'BLOCK' | 'MUTE';
export type RelationshipStatus = 'ACTIVE' | 'REMOVED';

export type FeedEventType =
  | 'POST_CREATED'
  | 'POST_LIKED'
  | 'POST_COMMENTED'
  | 'POST_SHARED'
  | 'FOLLOWED_USER'
  | 'UNFOLLOWED_USER';

export type FeedEntityType = 'POST' | 'USER' | 'COMMENT' | 'SHARE';

export interface SocialRelationshipItem {
  pk: string;
  sk: string;
  gsi1pk: string;
  gsi1sk: string;
  sourceUserId: number;
  targetUserId: number;
  relationshipType: RelationshipType;
  status: RelationshipStatus;
  createdAt: string;
  updatedAt: string;
  ttl?: number;
}

export interface FeedEventItem {
  pk: string;
  sk: string;
  gsi1pk: string;
  gsi1sk: string;
  gsi2pk?: string;
  gsi2sk?: string;
  feedUserId: number;
  actorUserId: number;
  eventType: FeedEventType;
  entityType: FeedEntityType;
  entityId: string;
  parentEntityId?: string;
  payload: Record<string, unknown>;
  visibility: 'PUBLIC' | 'FOLLOWERS' | 'PRIVATE';
  createdAt: string;
  ttl?: number;
}

const userKey = (userId: number) => `${DYNAMO_PREFIXES.user}#${userId}`;

const timestampKey = (value: string) => value.replace(/[:.]/g, '-');

export const relationshipKey = (
  sourceUserId: number,
  targetUserId: number,
  relationshipType?: RelationshipType,
) => ({
  pk: userKey(sourceUserId),
  sk: relationshipType
    ? `${DYNAMO_PREFIXES.relationship}#${relationshipType}#${targetUserId}`
    : `${DYNAMO_PREFIXES.relationship}#${targetUserId}`,
  gsi1pk: userKey(targetUserId),
  gsi1sk: relationshipType
    ? `${DYNAMO_PREFIXES.user}#${sourceUserId}#${relationshipType}`
    : `${DYNAMO_PREFIXES.user}#${sourceUserId}`,
});

export const feedKey = (feedUserId: number, actorUserId: number, createdAt: string, eventId: string) => ({
  pk: `${DYNAMO_PREFIXES.feed}#${feedUserId}`,
  sk: `${timestampKey(createdAt)}#${DYNAMO_PREFIXES.event}#${eventId}`,
  gsi1pk: `${DYNAMO_PREFIXES.actor}#${actorUserId}`,
  gsi1sk: `${timestampKey(createdAt)}#${DYNAMO_PREFIXES.event}#${eventId}`,
});

export const feedEntityKey = (entityType: FeedEntityType, entityId: string) => ({
  gsi2pk: `${DYNAMO_PREFIXES.entity}#${entityType}#${entityId}`,
});

export const buildRelationshipItem = (item: Omit<SocialRelationshipItem, 'pk' | 'sk' | 'gsi1pk' | 'gsi1sk'>) => ({
  ...item,
  ...relationshipKey(item.sourceUserId, item.targetUserId, item.relationshipType),
});

export const buildFeedEventItem = (
  item: Omit<FeedEventItem, 'pk' | 'sk' | 'gsi1pk' | 'gsi1sk' | 'gsi2pk' | 'gsi2sk'>,
  eventId: string,
) => ({
  ...item,
  ...feedKey(item.feedUserId, item.actorUserId, item.createdAt, eventId),
  ...feedEntityKey(item.entityType, item.entityId),
  gsi2sk: `${timestampKey(item.createdAt)}#${DYNAMO_PREFIXES.event}#${eventId}`,
});

export const DYNAMO_ACCESS_PATTERNS = {
  socialRelationships: [
    'Listar seguidos de un usuario.',
    'Listar seguidores de un usuario.',
    'Verificar si existe follow, block o mute entre dos usuarios.',
    'Listar bloqueados o silenciados por un usuario.',
    'Resolver relaciones para recomendaciones o mutuals.',
  ],
  feedEvents: [
    'Listar el feed mas reciente de un usuario.',
    'Paginacion por cursor basada en createdAt/eventId.',
    'Listar eventos generados por un actor.',
    'Listar actividad asociada a una entidad, por ejemplo un post.',
    'Materializar eventos de social graph para consumo rapido del feed.',
  ],
} as const;
