import {
  BatchGetCommand,
  GetCommand,
  PutCommand,
  QueryCommand,
  ScanCommand,
  TransactWriteCommand,
  UpdateCommand,
} from '@aws-sdk/lib-dynamodb';
import { randomUUID } from 'crypto';
import { ddbDocClient, INDEXES, TABLES } from '../config/dynamo';
import { Comment, Post, PostId } from '../models/post.model';
import { UserId } from '../models/user.model';

export interface PostRepositoryFindManyFilters {
  userId?: UserId;
  expiresAfter?: Date;
  currentUserId?: UserId;
  limit: number;
  cursorCreatedAt?: Date;
  cursorPostId?: PostId;
}

export interface PostFeedReference {
  postId: PostId;
  userId: UserId;
  createdAt: Date;
}

export interface PostLikeState {
  likes: number;
  likedByMe: boolean;
}

const generatePostId = (): PostId => Number(`${Date.now()}${Math.floor(Math.random() * 1000)}`);

const parseDate = (value?: string | number | Date): Date =>
  value instanceof Date ? value : new Date(value ?? Date.now());

const mapItemToPost = (item: any, likedByMe = false): Post => ({
  id: item.postId,
  userId: item.userId,
  content: item.content,
  media_url: item.media_url,
  createdAt: parseDate(item.createdAt),
  expiresAt: parseDate(item.expiresAt),
  likes: item.likes ?? 0,
  commentCount: item.commentCount ?? 0,
  shareCount: item.shareCount ?? 0,
  reportsCount: item.reportsCount ?? 0,
  likedByMe,
  is_deleted: Boolean(item.is_deleted),
});

const comparePostsDesc = (a: any, b: any) => {
  const byCreatedAt = String(b.createdAt).localeCompare(String(a.createdAt));
  if (byCreatedAt !== 0) {
    return byCreatedAt;
  }

  return Number(b.postId) - Number(a.postId);
};

const isConditionalTransactionFailure = (error: unknown) => {
  const maybeError = error as { name?: string; message?: string };
  return maybeError?.name === 'TransactionCanceledException'
    || maybeError?.name === 'ConditionalCheckFailedException';
};

export class PostRepository {
  async create(
    data: Omit<Post, 'id' | 'likes' | 'likedByMe' | 'is_deleted'> & { is_deleted?: boolean }
  ): Promise<PostId> {
    const postId = generatePostId();

    await ddbDocClient.send(
      new PutCommand({
        TableName: TABLES.FEED,
        Item: {
          postId,
          userId: data.userId,
          content: data.content,
          media_url: data.media_url,
          createdAt: data.createdAt.toISOString(),
          expiresAt: data.expiresAt.toISOString(),
          likes: 0,
          commentCount: 0,
          shareCount: 0,
          reportsCount: 0,
          fanOutReady: false,
          is_deleted: data.is_deleted ?? false,
        },
        ConditionExpression: 'attribute_not_exists(postId)',
      })
    );

    return postId;
  }

  async findById(id: PostId, currentUserId?: UserId): Promise<Post | null> {
    const result = await ddbDocClient.send(
      new GetCommand({
        TableName: TABLES.FEED,
        Key: { postId: id },
      })
    );

    if (!result.Item || result.Item.is_deleted) {
      return null;
    }

    const likedByMe = currentUserId ? await this.userLiked(id, currentUserId) : false;
    return mapItemToPost(result.Item, likedByMe);
  }

  private async userLiked(postId: PostId, userId: UserId): Promise<boolean> {
    const result = await ddbDocClient.send(
      new GetCommand({
        TableName: TABLES.POST_LIKES,
        Key: { postId, userId },
      })
    );

    return Boolean(result.Item);
  }

  async findMany(filters: PostRepositoryFindManyFilters): Promise<Post[]> {
    const items: any[] = [];
    const expressions: string[] = [
      '(is_deleted <> :true OR attribute_not_exists(is_deleted))',
      '(fanOutReady = :fanOutReady OR attribute_not_exists(fanOutReady))',
    ];
    const expressionValues: Record<string, any> = {
      ':true': true,
      ':fanOutReady': true,
    };

    if (filters.expiresAfter) {
      expressions.push('expiresAt > :exp');
      expressionValues[':exp'] = filters.expiresAfter.toISOString();
    }

    const filterExpression = expressions.join(' AND ');

    if (filters.userId) {
      const queryInput = {
        TableName: TABLES.FEED,
        IndexName: INDEXES.FEED_USER_CREATED_AT,
        KeyConditionExpression: 'userId = :uid',
        ExpressionAttributeValues: {
          ':uid': filters.userId,
          ...expressionValues,
        },
        FilterExpression: filterExpression,
      };

      try {
        await this.collectAllQueries(queryInput, items);
      } catch {
        await this.collectAllScans(
          {
            TableName: TABLES.FEED,
            FilterExpression: `${filterExpression} AND userId = :uid`,
            ExpressionAttributeValues: {
              ...expressionValues,
              ':uid': filters.userId,
            },
          },
          items,
        );
      }
    } else {
      await this.collectAllScans(
        {
          TableName: TABLES.FEED,
          FilterExpression: filterExpression,
          ExpressionAttributeValues: expressionValues,
        },
        items,
      );
    }

    let visible = items.sort(comparePostsDesc);

    if (filters.cursorCreatedAt && filters.cursorPostId !== undefined) {
      const cursorDateIso = filters.cursorCreatedAt.toISOString();
      visible = visible.filter((item) => {
        if (item.createdAt < cursorDateIso) {
          return true;
        }

        if (item.createdAt > cursorDateIso) {
          return false;
        }

        return Number(item.postId) < Number(filters.cursorPostId);
      });
    }

    const sliced = visible.slice(0, filters.limit);

    const likedMap =
      filters.currentUserId && sliced.length > 0
        ? await this.getLikedMap(
            sliced.map((item) => Number(item.postId)),
            filters.currentUserId,
          )
        : {};

    return sliced.map((item) => mapItemToPost(item, likedMap[item.postId] ?? false));
  }

  async findByIds(postIds: PostId[], currentUserId?: UserId): Promise<Post[]> {
    const orderedUniquePostIds = Array.from(new Set(postIds.map((id) => Number(id))));
    if (orderedUniquePostIds.length === 0) {
      return [];
    }

    const response = await ddbDocClient.send(
      new BatchGetCommand({
        RequestItems: {
          [TABLES.FEED]: {
            Keys: orderedUniquePostIds.map((postId) => ({ postId })),
          },
        },
      }),
    );

    const items = (response.Responses?.[TABLES.FEED] ?? [])
      .filter((item) => !item.is_deleted)
      .filter((item) => item.fanOutReady !== false);
    const itemById = new Map<number, any>();

    for (const item of items) {
      itemById.set(Number(item.postId), item);
    }

    const likedMap =
      currentUserId
        ? await this.getLikedMap(orderedUniquePostIds, currentUserId)
        : {};

    return orderedUniquePostIds
      .map((postId) => itemById.get(postId))
      .filter((item): item is any => Boolean(item))
      .map((item) => mapItemToPost(item, likedMap[Number(item.postId)] ?? false));
  }

  async listVisiblePostReferencesByAuthors(authorIds: UserId[], expiresAfter: Date): Promise<PostFeedReference[]> {
    const uniqueAuthorIds = Array.from(new Set(authorIds.filter((id) => Number.isInteger(id) && id > 0)));
    if (uniqueAuthorIds.length === 0) {
      return [];
    }

    const references: PostFeedReference[] = [];
    const expiresAfterIso = expiresAfter.toISOString();

    for (const authorId of uniqueAuthorIds) {
      let lastKey: Record<string, unknown> | undefined;

      do {
        const result = await ddbDocClient.send(
          new QueryCommand({
            TableName: TABLES.FEED,
            IndexName: INDEXES.FEED_USER_CREATED_AT,
            KeyConditionExpression: 'userId = :uid',
            FilterExpression: [
              '(is_deleted <> :true OR attribute_not_exists(is_deleted))',
              '(fanOutReady = :fanOutReady OR attribute_not_exists(fanOutReady))',
              'expiresAt > :exp',
            ].join(' AND '),
            ExpressionAttributeValues: {
              ':uid': authorId,
              ':true': true,
              ':fanOutReady': true,
              ':exp': expiresAfterIso,
            },
            ScanIndexForward: false,
            ExclusiveStartKey: lastKey,
          }),
        );

        if (result.Items) {
          for (const item of result.Items) {
            references.push({
              postId: Number(item.postId),
              userId: Number(item.userId),
              createdAt: parseDate(item.createdAt),
            });
          }
        }

        lastKey = result.LastEvaluatedKey as Record<string, unknown> | undefined;
      } while (lastKey);
    }

    return references;
  }

  private async collectAllQueries(input: any, buffer: any[]) {
    let lastKey: Record<string, any> | undefined;

    do {
      const result = await ddbDocClient.send(
        new QueryCommand({
          ...input,
          ExclusiveStartKey: lastKey,
        })
      );

      if (result.Items) {
        buffer.push(...result.Items);
      }

      lastKey = result.LastEvaluatedKey as any;
    } while (lastKey);
  }

  private async collectAllScans(input: any, buffer: any[]) {
    let lastKey: Record<string, any> | undefined;

    do {
      const result = await ddbDocClient.send(
        new ScanCommand({
          ...input,
          ExclusiveStartKey: lastKey,
        })
      );

      if (result.Items) {
        buffer.push(...result.Items);
      }

      lastKey = result.LastEvaluatedKey as any;
    } while (lastKey);
  }

  private async getLikedMap(postIds: PostId[], userId: UserId): Promise<Record<PostId, boolean>> {
    if (postIds.length === 0) {
      return {};
    }

    const keys = postIds.map((postId) => ({ postId, userId }));
    const response = await ddbDocClient.send(
      new BatchGetCommand({
        RequestItems: {
          [TABLES.POST_LIKES]: {
            Keys: keys,
          },
        },
      })
    );

    const result: Record<PostId, boolean> = {};
    const likedItems = response.Responses?.[TABLES.POST_LIKES] ?? [];

    for (const item of likedItems) {
      result[Number(item.postId)] = true;
    }

    return result;
  }

  async countMany(filters: Pick<PostRepositoryFindManyFilters, 'userId' | 'expiresAfter'> = {}): Promise<number> {
    let count = 0;
    const expressions: string[] = ['(is_deleted <> :true OR attribute_not_exists(is_deleted))'];
    const expressionValues: Record<string, any> = { ':true': true };

    if (filters.expiresAfter) {
      expressions.push('expiresAt > :exp');
      expressionValues[':exp'] = filters.expiresAfter.toISOString();
    }

    const filterExpression = expressions.join(' AND ');

    if (filters.userId) {
      try {
        let lastKey: Record<string, any> | undefined;
        do {
          const result = await ddbDocClient.send(
            new QueryCommand({
              TableName: TABLES.FEED,
              IndexName: INDEXES.FEED_USER_CREATED_AT,
              KeyConditionExpression: 'userId = :uid',
              FilterExpression: filterExpression,
              ExpressionAttributeValues: {
                ':uid': filters.userId,
                ...expressionValues,
              },
              Select: 'COUNT',
              ExclusiveStartKey: lastKey,
            })
          );

          count += result.Count ?? 0;
          lastKey = result.LastEvaluatedKey as any;
        } while (lastKey);
      } catch {
        let lastKey: Record<string, any> | undefined;
        do {
          const result = await ddbDocClient.send(
            new ScanCommand({
              TableName: TABLES.FEED,
              FilterExpression: `${filterExpression} AND userId = :uid`,
              ExpressionAttributeValues: {
                ...expressionValues,
                ':uid': filters.userId,
              },
              Select: 'COUNT',
              ExclusiveStartKey: lastKey,
            })
          );

          count += result.Count ?? 0;
          lastKey = result.LastEvaluatedKey as any;
        } while (lastKey);
      }
    } else {
      let lastKey: Record<string, any> | undefined;
      do {
        const result = await ddbDocClient.send(
          new ScanCommand({
            TableName: TABLES.FEED,
            FilterExpression: filterExpression,
            ExpressionAttributeValues: expressionValues,
            Select: 'COUNT',
            ExclusiveStartKey: lastKey,
          })
        );

        count += result.Count ?? 0;
        lastKey = result.LastEvaluatedKey as any;
      } while (lastKey);
    }

    return count;
  }

  async markFanOutReady(id: PostId): Promise<void> {
    await ddbDocClient.send(
      new UpdateCommand({
        TableName: TABLES.FEED,
        Key: { postId: id },
        UpdateExpression: 'SET fanOutReady = :ready',
        ExpressionAttributeValues: {
          ':ready': true,
        },
        ConditionExpression: 'attribute_exists(postId)',
      })
    );
  }

  async updateExpiresAt(id: PostId, expiresAt: Date): Promise<void> {
    await ddbDocClient.send(
      new UpdateCommand({
        TableName: TABLES.FEED,
        Key: { postId: id },
        UpdateExpression: 'SET expiresAt = :exp',
        ExpressionAttributeValues: {
          ':exp': expiresAt.toISOString(),
        },
        ConditionExpression: 'attribute_exists(postId)',
      })
    );
  }

  async delete(id: PostId): Promise<void> {
    await ddbDocClient.send(
      new UpdateCommand({
        TableName: TABLES.FEED,
        Key: { postId: id },
        UpdateExpression: 'SET is_deleted = :true',
        ExpressionAttributeValues: { ':true': true },
        ConditionExpression: 'attribute_exists(postId)',
      })
    );
  }

  async toggleLike(postId: PostId, userId: UserId): Promise<number> {
    const currentlyLiked = await this.userLiked(postId, userId);
    const state = await this.setLike(postId, userId, !currentlyLiked);
    return state.likes;
  }

  async setLike(postId: PostId, userId: UserId, liked: boolean): Promise<PostLikeState> {
    const transaction = liked
      ? new TransactWriteCommand({
          TransactItems: [
            {
              Put: {
                TableName: TABLES.POST_LIKES,
                Item: {
                  postId,
                  userId,
                  createdAt: new Date().toISOString(),
                },
                ConditionExpression: 'attribute_not_exists(postId) AND attribute_not_exists(userId)',
              },
            },
            {
              Update: {
                TableName: TABLES.FEED,
                Key: { postId },
                UpdateExpression: 'SET #likes = if_not_exists(#likes, :zero) + :one',
                ConditionExpression: 'attribute_exists(postId) AND (is_deleted <> :true OR attribute_not_exists(is_deleted))',
                ExpressionAttributeNames: { '#likes': 'likes' },
                ExpressionAttributeValues: {
                  ':zero': 0,
                  ':one': 1,
                  ':true': true,
                },
              },
            },
          ],
        })
      : new TransactWriteCommand({
          TransactItems: [
            {
              Delete: {
                TableName: TABLES.POST_LIKES,
                Key: { postId, userId },
                ConditionExpression: 'attribute_exists(postId) AND attribute_exists(userId)',
              },
            },
            {
              Update: {
                TableName: TABLES.FEED,
                Key: { postId },
                UpdateExpression: 'SET #likes = #likes - :one',
                ConditionExpression: 'attribute_exists(postId) AND #likes >= :one AND (is_deleted <> :true OR attribute_not_exists(is_deleted))',
                ExpressionAttributeNames: { '#likes': 'likes' },
                ExpressionAttributeValues: {
                  ':one': 1,
                  ':true': true,
                },
              },
            },
          ],
        });

    try {
      await ddbDocClient.send(transaction);
    } catch (error) {
      if (!isConditionalTransactionFailure(error)) {
        throw error;
      }
    }

    const post = await this.getPostLikeState(postId, userId);
    if (!post) {
      throw new Error('Post not found');
    }

    return post;
  }

  private async getPostLikeState(postId: PostId, userId: UserId): Promise<PostLikeState | null> {
    const [postResult, likeResult] = await Promise.all([
      ddbDocClient.send(
        new GetCommand({
          TableName: TABLES.FEED,
          Key: { postId },
          ConsistentRead: true,
        })
      ),
      ddbDocClient.send(
        new GetCommand({
          TableName: TABLES.POST_LIKES,
          Key: { postId, userId },
          ConsistentRead: true,
        })
      ),
    ]);

    if (!postResult.Item || postResult.Item.is_deleted) {
      return null;
    }

    return {
      likes: Number(postResult.Item.likes ?? 0),
      likedByMe: Boolean(likeResult.Item),
    };
  }

  async addComment(postId: PostId, userId: UserId, content: string): Promise<Comment> {
    const commentId = `${Date.now()}#${randomUUID()}`;
    const now = new Date();

    await ddbDocClient.send(
      new TransactWriteCommand({
        TransactItems: [
          {
            Put: {
              TableName: TABLES.POST_COMMENTS,
              Item: {
                postId,
                commentId,
                userId,
                content,
                createdAt: now.toISOString(),
                updatedAt: now.toISOString(),
              },
              ConditionExpression: 'attribute_not_exists(postId) AND attribute_not_exists(commentId)',
            },
          },
          {
            Update: {
              TableName: TABLES.FEED,
              Key: { postId },
              UpdateExpression: 'SET commentCount = if_not_exists(commentCount, :zero) + :one',
              ConditionExpression: 'attribute_exists(postId) AND (is_deleted <> :true OR attribute_not_exists(is_deleted))',
              ExpressionAttributeValues: {
                ':zero': 0,
                ':one': 1,
                ':true': true,
              },
            },
          },
        ],
      })
    );

    return {
      commentId,
      postId,
      userId,
      content,
      createdAt: now,
      updatedAt: now,
    };
  }

  async listComments(postId: PostId): Promise<Comment[]> {
    const items: any[] = [];
    let lastKey: Record<string, any> | undefined;

    do {
      const result = await ddbDocClient.send(
        new QueryCommand({
          TableName: TABLES.POST_COMMENTS,
          KeyConditionExpression: 'postId = :pid',
          ExpressionAttributeValues: {
            ':pid': postId,
          },
          ScanIndexForward: true,
          ExclusiveStartKey: lastKey,
        })
      );

      if (result.Items) {
        items.push(...result.Items);
      }

      lastKey = result.LastEvaluatedKey as any;
    } while (lastKey);

    return items.map((item) => ({
      commentId: item.commentId,
      postId: item.postId,
      userId: item.userId,
      content: item.content,
      createdAt: parseDate(item.createdAt),
      updatedAt: item.updatedAt ? parseDate(item.updatedAt) : undefined,
    }));
  }

  async deleteComment(postId: PostId, commentId: string): Promise<void> {
    try {
      await ddbDocClient.send(
        new TransactWriteCommand({
          TransactItems: [
            {
              Delete: {
                TableName: TABLES.POST_COMMENTS,
                Key: { postId, commentId },
                ConditionExpression: 'attribute_exists(postId) AND attribute_exists(commentId)',
              },
            },
            {
              Update: {
                TableName: TABLES.FEED,
                Key: { postId },
                UpdateExpression: 'SET commentCount = commentCount - :one',
                ConditionExpression: 'attribute_exists(postId) AND commentCount >= :one',
                ExpressionAttributeValues: {
                  ':one': 1,
                },
              },
            },
          ],
        })
      );
    } catch (error) {
      if (!isConditionalTransactionFailure(error)) {
        throw error;
      }
    }
  }

  async share(postId: PostId, userId: UserId): Promise<number> {
    try {
      await ddbDocClient.send(
        new TransactWriteCommand({
          TransactItems: [
            {
              Put: {
                TableName: TABLES.POST_SHARES,
                Item: {
                  postId,
                  userId,
                  createdAt: new Date().toISOString(),
                },
                ConditionExpression: 'attribute_not_exists(postId) AND attribute_not_exists(userId)',
              },
            },
            {
              Update: {
                TableName: TABLES.FEED,
                Key: { postId },
                UpdateExpression: 'SET shareCount = if_not_exists(shareCount, :zero) + :one',
                ConditionExpression: 'attribute_exists(postId) AND (is_deleted <> :true OR attribute_not_exists(is_deleted))',
                ExpressionAttributeValues: {
                  ':zero': 0,
                  ':one': 1,
                  ':true': true,
                },
              },
            },
          ],
        })
      );
    } catch (error) {
      if (!isConditionalTransactionFailure(error)) {
        throw error;
      }
    }

    const post = await this.findById(postId);
    return post?.shareCount ?? 0;
  }

  async incrementReports(postId: PostId): Promise<number | null> {
    const result = await ddbDocClient.send(
      new UpdateCommand({
        TableName: TABLES.FEED,
        Key: { postId },
        UpdateExpression: 'SET reportsCount = if_not_exists(reportsCount, :zero) + :one',
        ExpressionAttributeValues: {
          ':zero': 0,
          ':one': 1,
        },
        ConditionExpression: 'attribute_exists(postId) AND (is_deleted <> :true OR attribute_not_exists(is_deleted))',
        ReturnValues: 'UPDATED_NEW',
      })
    ).catch(() => null);

    if (!result) {
      return null;
    }

    return Number(result.Attributes?.reportsCount ?? 0);
  }
}

export const postRepository = new PostRepository();