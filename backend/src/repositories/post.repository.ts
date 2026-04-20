import {
  BatchGetCommand,
  DeleteCommand,
  GetCommand,
  PutCommand,
  QueryCommand,
  ScanCommand,
  UpdateCommand,
} from '@aws-sdk/lib-dynamodb';
import { v4 as uuidv4 } from 'uuid';
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
    const expressions: string[] = ['(is_deleted <> :true OR attribute_not_exists(is_deleted))'];
    const expressionValues: Record<string, any> = { ':true': true };

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

  private async updateLikeCount(postId: PostId, delta: number): Promise<number> {
    const result = await ddbDocClient.send(
      new UpdateCommand({
        TableName: TABLES.FEED,
        Key: { postId },
        UpdateExpression: 'SET #likes = if_not_exists(#likes, :zero) + :delta',
        ExpressionAttributeNames: { '#likes': 'likes' },
        ExpressionAttributeValues: {
          ':zero': 0,
          ':delta': delta,
        },
        ReturnValues: 'UPDATED_NEW',
      })
    );

    const likes = Number(result.Attributes?.likes ?? 0);
    if (likes < 0) {
      await ddbDocClient.send(
        new UpdateCommand({
          TableName: TABLES.FEED,
          Key: { postId },
          UpdateExpression: 'SET #likes = :zero',
          ExpressionAttributeNames: { '#likes': 'likes' },
          ExpressionAttributeValues: { ':zero': 0 },
        })
      );
      return 0;
    }

    return likes;
  }

  async toggleLike(postId: PostId, userId: UserId): Promise<number> {
    const existing = await ddbDocClient.send(
      new GetCommand({
        TableName: TABLES.POST_LIKES,
        Key: { postId, userId },
      })
    );

    if (existing.Item) {
      await ddbDocClient.send(
        new DeleteCommand({
          TableName: TABLES.POST_LIKES,
          Key: { postId, userId },
        })
      );

      return this.updateLikeCount(postId, -1);
    }

    await ddbDocClient.send(
      new PutCommand({
        TableName: TABLES.POST_LIKES,
        Item: {
          postId,
          userId,
          createdAt: new Date().toISOString(),
        },
        ConditionExpression: 'attribute_not_exists(postId) AND attribute_not_exists(userId)',
      })
    );

    return this.updateLikeCount(postId, 1);
  }

  async addComment(postId: PostId, userId: UserId, content: string): Promise<Comment> {
    const commentId = `${Date.now()}#${uuidv4()}`;
    const now = new Date();

    await ddbDocClient.send(
      new PutCommand({
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
      })
    );

    await ddbDocClient.send(
      new UpdateCommand({
        TableName: TABLES.FEED,
        Key: { postId },
        UpdateExpression: 'SET commentCount = if_not_exists(commentCount, :zero) + :one',
        ExpressionAttributeValues: {
          ':zero': 0,
          ':one': 1,
        },
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
    await ddbDocClient.send(
      new DeleteCommand({
        TableName: TABLES.POST_COMMENTS,
        Key: { postId, commentId },
      })
    );

    await ddbDocClient.send(
      new UpdateCommand({
        TableName: TABLES.FEED,
        Key: { postId },
        UpdateExpression: 'SET commentCount = if_not_exists(commentCount, :zero) - :one',
        ExpressionAttributeValues: {
          ':zero': 0,
          ':one': 1,
        },
      })
    );
  }

  async share(postId: PostId, userId: UserId): Promise<number> {
    const existing = await ddbDocClient.send(
      new GetCommand({
        TableName: TABLES.POST_SHARES,
        Key: { postId, userId },
      })
    );

    if (!existing.Item) {
      await ddbDocClient.send(
        new PutCommand({
          TableName: TABLES.POST_SHARES,
          Item: {
            postId,
            userId,
            createdAt: new Date().toISOString(),
          },
          ConditionExpression: 'attribute_not_exists(postId) AND attribute_not_exists(userId)',
        })
      );

      await ddbDocClient.send(
        new UpdateCommand({
          TableName: TABLES.FEED,
          Key: { postId },
          UpdateExpression: 'SET shareCount = if_not_exists(shareCount, :zero) + :one',
          ExpressionAttributeValues: {
            ':zero': 0,
            ':one': 1,
          },
        })
      );
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
