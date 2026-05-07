import { QueryCommand, TransactWriteCommand } from '@aws-sdk/lib-dynamodb';
import { ddbDocClient, TABLES } from '../config/dynamo';
import { PostId } from '../models/post.model';
import { UserId } from '../models/user.model';

export interface FeedTimelineWriteInput {
  postId: PostId;
  actorUserId: UserId;
  feedUserIds: UserId[];
  createdAt: Date;
}

export interface FeedTimelineReadInput {
  feedUserId: UserId;
  limit: number;
  cursorCreatedAt?: Date;
  cursorPostId?: PostId;
}

export interface FeedTimelineItem {
  feedUserId: UserId;
  sk: string;
  postId: PostId;
  actorUserId: UserId;
  createdAt: string;
}

export interface FeedTimelineUpsertItem {
  feedUserId: UserId;
  postId: PostId;
  actorUserId: UserId;
  createdAt: Date;
}

export interface FeedTimelineReconcileInput {
  feedUserId: UserId;
  staleSortKeys: string[];
  upserts: FeedTimelineUpsertItem[];
}

const MAX_TXN_ITEMS = 25;
const POST_ID_SORT_WIDTH = 20;
const MAX_RETRY_ATTEMPTS = 3;

const toSortablePostId = (postId: PostId): string => {
  const numericPostId = Number(postId);
  if (!Number.isInteger(numericPostId) || numericPostId < 0) {
    throw new Error('postId must be a non-negative integer');
  }

  return String(numericPostId).padStart(POST_ID_SORT_WIDTH, '0');
};

const toTimelineSk = (createdAtIso: string, postId: PostId) => `${createdAtIso}#POST#${toSortablePostId(postId)}`;

const chunkArray = <T>(items: T[], chunkSize: number): T[][] => {
  const chunks: T[][] = [];

  for (let index = 0; index < items.length; index += chunkSize) {
    chunks.push(items.slice(index, index + chunkSize));
  }

  return chunks;
};

export class FeedTimelineRepository {
  buildSortKey(createdAt: Date, postId: PostId): string {
    return toTimelineSk(createdAt.toISOString(), postId);
  }

  async fanOutPostCreated(input: FeedTimelineWriteInput): Promise<void> {
    const uniqueFeedUserIds = Array.from(
      new Set(input.feedUserIds.filter((userId) => Number.isInteger(userId) && userId > 0)),
    );

    if (uniqueFeedUserIds.length === 0) {
      return;
    }

    const createdAtIso = input.createdAt.toISOString();
    const sk = toTimelineSk(createdAtIso, input.postId);
    const chunks = chunkArray(uniqueFeedUserIds, MAX_TXN_ITEMS);
    const committedChunks: UserId[][] = [];

    try {
      for (const chunk of chunks) {
        await this.executeWithRetry(() => this.writeChunk(chunk, sk, input.postId, input.actorUserId, createdAtIso));
        committedChunks.push(chunk);
      }
    } catch (writeError) {
      await this.rollbackCommittedChunks(committedChunks, sk);
      throw writeError;
    }
  }

  private async writeChunk(
    feedUserIds: UserId[],
    sk: string,
    postId: PostId,
    actorUserId: UserId,
    createdAtIso: string,
  ): Promise<void> {
    await ddbDocClient.send(
      new TransactWriteCommand({
        TransactItems: feedUserIds.map((feedUserId) => ({
          Put: {
            TableName: TABLES.FEED_TIMELINE,
            Item: {
              feedUserId: String(feedUserId),
              sk,
              postId: String(postId),
              actorUserId: String(actorUserId),
              createdAt: createdAtIso,
            },
            ConditionExpression: 'attribute_not_exists(feedUserId) AND attribute_not_exists(sk)',
          },
        })),
      }),
    );
  }

  private async rollbackCommittedChunks(chunks: UserId[][], sk: string): Promise<void> {
    const rollbackErrors: unknown[] = [];

    for (let index = chunks.length - 1; index >= 0; index -= 1) {
      const chunk = chunks[index];

      try {
        await this.executeWithRetry(() =>
          ddbDocClient.send(
            new TransactWriteCommand({
              TransactItems: chunk.map((feedUserId) => ({
                Delete: {
                  TableName: TABLES.FEED_TIMELINE,
                  Key: {
                    feedUserId,
                    sk,
                  },
                },
              })),
            }),
          ));
      } catch (rollbackError) {
        rollbackErrors.push(rollbackError);
      }
    }

    if (rollbackErrors.length > 0) {
      throw new Error('Fan-out rollback failed after retries for one or more chunks');
    }
  }

  private async executeWithRetry<T>(operation: () => Promise<T>): Promise<T> {
    let lastError: unknown;

    for (let attempt = 1; attempt <= MAX_RETRY_ATTEMPTS; attempt += 1) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;
      }
    }

    throw lastError;
  }

  async listPostIds(input: FeedTimelineReadInput): Promise<PostId[]> {
    const postIds: PostId[] = [];
    let lastKey: Record<string, unknown> | undefined;

    if (!Number.isInteger(input.limit) || input.limit <= 0) {
      return [];
    }

    const expressionAttributeValues: Record<string, unknown> = {
      ':feedUserId': String(input.feedUserId),
    };

    let keyConditionExpression = 'feedUserId = :feedUserId';
    if (input.cursorCreatedAt && input.cursorPostId !== undefined) {
      expressionAttributeValues[':cursorSk'] = toTimelineSk(input.cursorCreatedAt.toISOString(), input.cursorPostId);
      keyConditionExpression += ' AND sk < :cursorSk';
    }

    do {
      const remaining = input.limit - postIds.length;
      if (remaining <= 0) {
        break;
      }

      const result = await ddbDocClient.send(
        new QueryCommand({
          TableName: TABLES.FEED_TIMELINE,
          KeyConditionExpression: keyConditionExpression,
          ExpressionAttributeValues: expressionAttributeValues,
          ScanIndexForward: false,
          Limit: remaining,
          ExclusiveStartKey: lastKey,
        }),
      );

      if (result.Items) {
        for (const item of result.Items as FeedTimelineItem[]) {
          postIds.push(Number(item.postId));
        }
      }

      lastKey = result.LastEvaluatedKey as Record<string, unknown> | undefined;
    } while (lastKey && postIds.length < input.limit);

    return postIds;
  }

  async listEntries(feedUserId: UserId): Promise<FeedTimelineItem[]> {
    const items: FeedTimelineItem[] = [];
    let lastKey: Record<string, unknown> | undefined;

    do {
      const result = await ddbDocClient.send(
        new QueryCommand({
          TableName: TABLES.FEED_TIMELINE,
          KeyConditionExpression: 'feedUserId = :feedUserId',
          ExpressionAttributeValues: {
            ':feedUserId': String(feedUserId),
          },
          ScanIndexForward: false,
          ExclusiveStartKey: lastKey,
        }),
      );

      if (result.Items) {
        items.push(...(result.Items as FeedTimelineItem[]));
      }

      lastKey = result.LastEvaluatedKey as Record<string, unknown> | undefined;
    } while (lastKey);

    return items;
  }

  private async upsertEntries(entries: FeedTimelineUpsertItem[]): Promise<void> {
    const validEntries = entries.filter(
      (entry) => Number.isInteger(entry.feedUserId) && entry.feedUserId > 0
        && Number.isInteger(entry.actorUserId) && entry.actorUserId > 0,
    );

    if (validEntries.length === 0) {
      return;
    }

    const chunks = chunkArray(validEntries, MAX_TXN_ITEMS);
    for (const chunk of chunks) {
      await this.executeWithRetry(() =>
        ddbDocClient.send(
          new TransactWriteCommand({
            TransactItems: chunk.map((entry) => ({
              Put: {
                TableName: TABLES.FEED_TIMELINE,
                Item: {
                  feedUserId: entry.feedUserId,
                  sk: toTimelineSk(entry.createdAt.toISOString(), entry.postId),
                  postId: entry.postId,
                  actorUserId: entry.actorUserId,
                  createdAt: entry.createdAt.toISOString(),
                },
              },
            })),
          }),
        ));
    }
  }

  private async deleteEntries(feedUserId: UserId, sortKeys: string[]): Promise<void> {
    const uniqueSortKeys = Array.from(new Set(sortKeys.filter((key) => Boolean(key))));
    if (uniqueSortKeys.length === 0) {
      return;
    }

    const chunks = chunkArray(uniqueSortKeys, MAX_TXN_ITEMS);
    for (const chunk of chunks) {
      await this.executeWithRetry(() =>
        ddbDocClient.send(
          new TransactWriteCommand({
            TransactItems: chunk.map((sk) => ({
              Delete: {
                TableName: TABLES.FEED_TIMELINE,
                Key: {
                  feedUserId: String(feedUserId),
                  sk,
                },
              },
            })),
          }),
        ));
    }
  }

  async reconcileEntries(input: FeedTimelineReconcileInput): Promise<void> {
    const uniqueSortKeys = Array.from(new Set(input.staleSortKeys.filter((key) => Boolean(key))));
    const validUpserts = input.upserts.filter(
      (entry) => Number.isInteger(entry.feedUserId) && entry.feedUserId > 0
        && Number.isInteger(entry.actorUserId) && entry.actorUserId > 0,
    );

    const transactItems = [
      ...validUpserts.map((entry) => ({
        Put: {
          TableName: TABLES.FEED_TIMELINE,
          Item: {
            feedUserId: String(entry.feedUserId),
            sk: toTimelineSk(entry.createdAt.toISOString(), entry.postId),
            postId: String(entry.postId),
            actorUserId: String(entry.actorUserId),
            createdAt: entry.createdAt.toISOString(),
          },
        },
      })),
      ...uniqueSortKeys.map((sk) => ({
        Delete: {
          TableName: TABLES.FEED_TIMELINE,
          Key: {
            feedUserId: input.feedUserId,
            sk,
          },
        },
      })),
    ];

    if (transactItems.length === 0) {
      return;
    }

    const chunks = chunkArray(transactItems, MAX_TXN_ITEMS);
    for (const chunk of chunks) {
      await this.executeWithRetry(() =>
        ddbDocClient.send(
          new TransactWriteCommand({
            TransactItems: chunk,
          }),
        ));
    }
  }
}

export const feedTimelineRepository = new FeedTimelineRepository();