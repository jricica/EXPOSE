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
import { Comment, Post, PostId, ShareRecord } from '../models/post.model';
import { UserId } from '../models/user.model';

export interface PostRepositoryFindManyFilters {
  userId?: UserId;
  expiresAfter?: Date;
  currentUserId?: UserId;
  limit?: number;
  offset?: number;
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
  likedByMe,
  is_deleted: false,
});

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

    if (!result.Item || result.Item.is_deleted) return null;

    const likedByMe = currentUserId ? await this.userLiked(id, currentUserId) : false;
    return mapItemToPost(result.Item, likedByMe);
  }

  private async userLiked(postId: PostId, userId: UserId): Promise<boolean> {
    const res = await ddbDocClient.send(
      new GetCommand({
        TableName: TABLES.POST_LIKES,
        Key: { postId, userId },
      })
    );
    return Boolean(res.Item);
  }

  async findMany(filters: PostRepositoryFindManyFilters = {}): Promise<Post[]> {
    const items: any[] = [];
    const expressions: string[] = ['is_deleted <> :true OR attribute_not_exists(is_deleted)'];
    const exprValues: Record<string, any> = { ':true': true };

    if (filters.expiresAfter) {
      expressions.push('expiresAt > :exp');
      exprValues[':exp'] = filters.expiresAfter.toISOString();
    }

    const filterExpression = expressions.length ? expressions.join(' AND ') : undefined;

    if (filters.userId) {
      const queryInput = {
        TableName: TABLES.FEED,
        IndexName: INDEXES.FEED_USER_CREATED_AT,
        KeyConditionExpression: 'userId = :uid',
        ExpressionAttributeValues: {
          ':uid': filters.userId,
          ...exprValues,
        },
        FilterExpression: filterExpression,
      };

      try {
        await this.collectAll(new QueryCommand(queryInput), items);
      } catch (err) {
        // Fallback a scan si el índice no existe
        const scanInput = {
          TableName: TABLES.FEED,
          FilterExpression: filterExpression
            ? `${filterExpression} AND userId = :uid`
            : 'userId = :uid',
          ExpressionAttributeValues: { ...exprValues, ':uid': filters.userId },
        };
        await this.collectAll(new ScanCommand(scanInput), items);
      }
    } else {
      const scanInput = {
        TableName: TABLES.FEED,
        FilterExpression: filterExpression,
        ExpressionAttributeValues: Object.keys(exprValues).length ? exprValues : undefined,
      };
      await this.collectAll(new ScanCommand(scanInput), items);
    }

    items.sort((a, b) => (a.createdAt > b.createdAt ? -1 : 1));

    const offset = filters.offset ?? 0;
    const limit = filters.limit ?? items.length;
    const sliced = items.slice(offset, offset + limit);

    const likedMap =
      filters.currentUserId && sliced.length
        ? await this.getLikedMap(
            sliced.map((p) => p.postId),
            filters.currentUserId
          )
        : {};

    return sliced.map((item) => mapItemToPost(item, likedMap[item.postId] ?? false));
  }

  private async collectAll(command: QueryCommand | ScanCommand, buffer: any[]) {
    let lastKey: Record<string, any> | undefined;
    do {
      const res = await ddbDocClient.send(
        command instanceof QueryCommand
          ? new QueryCommand({ ...(command as any).input, ExclusiveStartKey: lastKey })
          : new ScanCommand({ ...(command as any).input, ExclusiveStartKey: lastKey })
      );
      if (res.Items) buffer.push(...res.Items);
      lastKey = res.LastEvaluatedKey as any;
    } while (lastKey);
  }

  private async getLikedMap(postIds: PostId[], userId: UserId): Promise<Record<PostId, boolean>> {
    if (!postIds.length) return {};

    const keys = postIds.map((postId) => ({ postId, userId }));
    const res = await ddbDocClient.send(
      new BatchGetCommand({
        RequestItems: {
          [TABLES.POST_LIKES]: {
            Keys: keys,
          },
        },
      })
    );

    const map: Record<PostId, boolean> = {};
    const received = res.Responses?.[TABLES.POST_LIKES] ?? [];
    for (const item of received) {
      map[item.postId] = true;
    }
    return map;
  }

  async countMany(
    filters: Omit<PostRepositoryFindManyFilters, 'limit' | 'offset' | 'currentUserId'> = {}
  ): Promise<number> {
    let count = 0;
    const expressions: string[] = ['is_deleted <> :true OR attribute_not_exists(is_deleted)'];
    const exprValues: Record<string, any> = { ':true': true };
    if (filters.expiresAfter) {
      expressions.push('expiresAt > :exp');
      exprValues[':exp'] = filters.expiresAfter.toISOString();
    }
    const filterExpression = expressions.join(' AND ');

    if (filters.userId) {
      try {
        let lastKey: Record<string, any> | undefined;
        do {
          const res = await ddbDocClient.send(
            new QueryCommand({
              TableName: TABLES.FEED,
              IndexName: INDEXES.FEED_USER_CREATED_AT,
              KeyConditionExpression: 'userId = :uid',
              ExpressionAttributeValues: { ':uid': filters.userId, ...exprValues },
              FilterExpression: filterExpression,
              Select: 'COUNT',
              ExclusiveStartKey: lastKey,
            })
          );
          count += res.Count ?? 0;
          lastKey = res.LastEvaluatedKey as any;
        } while (lastKey);
      } catch {
        let scanKey: Record<string, any> | undefined;
        do {
          const res = await ddbDocClient.send(
            new ScanCommand({
              TableName: TABLES.FEED,
              FilterExpression: filterExpression
                ? `${filterExpression} AND userId = :uid`
                : 'userId = :uid',
              ExpressionAttributeValues: { ...exprValues, ':uid': filters.userId },
              Select: 'COUNT',
              ExclusiveStartKey: scanKey,
            })
          );
          count += res.Count ?? 0;
          scanKey = res.LastEvaluatedKey as any;
        } while (scanKey);
      }
    } else {
      let lastKey: Record<string, any> | undefined;
      do {
        const res = await ddbDocClient.send(
          new ScanCommand({
            TableName: TABLES.FEED,
            FilterExpression: filterExpression,
            ExpressionAttributeValues: exprValues,
            Select: 'COUNT',
            ExclusiveStartKey: lastKey,
          })
        );
        count += res.Count ?? 0;
        lastKey = res.LastEvaluatedKey as any;
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
        ExpressionAttributeValues: { ':exp': expiresAt.toISOString() },
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
    const res = await ddbDocClient.send(
      new UpdateCommand({
        TableName: TABLES.FEED,
        Key: { postId },
        UpdateExpression: 'SET #likes = if_not_exists(#likes, :zero) + :delta',
        ExpressionAttributeNames: { '#likes': 'likes' },
        ExpressionAttributeValues: { ':delta': delta, ':zero': 0 },
        ReturnValues: 'UPDATED_NEW',
      })
    );
    const likes = Number(res.Attributes?.likes ?? 0);
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
      return await this.updateLikeCount(postId, -1);
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

    return await this.updateLikeCount(postId, 1);
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
        ExpressionAttributeValues: { ':zero': 0, ':one': 1 },
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
    let lastKey: any;

    do {
      const res = await ddbDocClient.send(
        new QueryCommand({
          TableName: TABLES.POST_COMMENTS,
          KeyConditionExpression: 'postId = :pid',
          ExpressionAttributeValues: { ':pid': postId },
          ExclusiveStartKey: lastKey,
          ScanIndexForward: true,
        })
      );
      if (res.Items) items.push(...res.Items);
      lastKey = res.LastEvaluatedKey;
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
        ExpressionAttributeValues: { ':zero': 0, ':one': 1 },
      })
    );
  }

  async share(postId: PostId, userId: UserId): Promise<number> {
    const now = new Date().toISOString();
    const exists = await ddbDocClient.send(
      new GetCommand({
        TableName: TABLES.POST_SHARES,
        Key: { postId, userId },
      })
    );

    if (!exists.Item) {
      await ddbDocClient.send(
        new PutCommand({
          TableName: TABLES.POST_SHARES,
          Item: { postId, userId, createdAt: now },
          ConditionExpression: 'attribute_not_exists(postId) AND attribute_not_exists(userId)',
        })
      );

      await ddbDocClient.send(
        new UpdateCommand({
          TableName: TABLES.FEED,
          Key: { postId },
          UpdateExpression: 'SET shareCount = if_not_exists(shareCount, :zero) + :one',
          ExpressionAttributeValues: { ':zero': 0, ':one': 1 },
        })
      );
    }

    const post = await this.findById(postId);
    return post?.shareCount ?? 0;
  }
}

export const postRepository = new PostRepository();
