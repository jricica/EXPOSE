import { DeleteCommand, GetCommand, PutCommand, QueryCommand, ScanCommand } from '@aws-sdk/lib-dynamodb';
import { ddbDocClient, INDEXES, TABLES } from '../config/dynamo';
import { RelationshipType, UserId, UserRelationship } from '../models/user.model';

export class RelationshipRepository {
  async follow(userId: UserId, targetUserId: UserId, relationshipType: RelationshipType = 'follow'): Promise<UserRelationship> {
    const createdAt = new Date();

    await ddbDocClient.send(
      new PutCommand({
        TableName: TABLES.RELATIONSHIPS,
        Item: {
          userId,
          targetUserId,
          relationshipType,
          createdAt: createdAt.toISOString(),
        },
        ConditionExpression: 'attribute_not_exists(userId) AND attribute_not_exists(targetUserId)',
      })
    );

    return { userId, targetUserId, relationshipType, createdAt };
  }

  async unfollow(userId: UserId, targetUserId: UserId): Promise<void> {
    await ddbDocClient.send(
      new DeleteCommand({
        TableName: TABLES.RELATIONSHIPS,
        Key: { userId, targetUserId },
      })
    );
  }

  async isFollowing(userId: UserId, targetUserId: UserId): Promise<boolean> {
    const res = await ddbDocClient.send(
      new GetCommand({
        TableName: TABLES.RELATIONSHIPS,
        Key: { userId, targetUserId },
      })
    );
    return Boolean(res.Item);
  }

  async listFollowing(userId: UserId): Promise<UserRelationship[]> {
    const items: any[] = [];
    let lastKey: any;
    do {
      const res = await ddbDocClient.send(
        new QueryCommand({
          TableName: TABLES.RELATIONSHIPS,
          KeyConditionExpression: 'userId = :uid',
          ExpressionAttributeValues: { ':uid': userId },
          ExclusiveStartKey: lastKey,
        })
      );
      if (res.Items) items.push(...res.Items);
      lastKey = res.LastEvaluatedKey;
    } while (lastKey);

    return items.map((item) => ({
      userId: item.userId,
      targetUserId: item.targetUserId,
      relationshipType: item.relationshipType,
      createdAt: new Date(item.createdAt),
    }));
  }

  async listFollowers(targetUserId: UserId): Promise<UserRelationship[]> {
    const items: any[] = [];
    let lastKey: any;
    const indexName = INDEXES.REL_TARGET_USER;

    try {
      do {
        const res = await ddbDocClient.send(
          new QueryCommand({
            TableName: TABLES.RELATIONSHIPS,
            IndexName: indexName,
            KeyConditionExpression: 'targetUserId = :tid',
            ExpressionAttributeValues: { ':tid': targetUserId },
            ExclusiveStartKey: lastKey,
          })
        );
        if (res.Items) items.push(...res.Items);
        lastKey = res.LastEvaluatedKey;
      } while (lastKey);
    } catch (err: any) {
      // fallback a scan si el índice no existe
      let scanKey: any;
      do {
        const res = await ddbDocClient.send(
          new ScanCommand({
            TableName: TABLES.RELATIONSHIPS,
            FilterExpression: 'targetUserId = :tid',
            ExpressionAttributeValues: { ':tid': targetUserId },
            ExclusiveStartKey: scanKey,
          })
        );
        if (res.Items) items.push(...res.Items);
        scanKey = res.LastEvaluatedKey;
      } while (scanKey);
    }

    return items.map((item) => ({
      userId: item.userId,
      targetUserId: item.targetUserId,
      relationshipType: item.relationshipType,
      createdAt: new Date(item.createdAt),
    }));
  }
}

export const relationshipRepository = new RelationshipRepository();
