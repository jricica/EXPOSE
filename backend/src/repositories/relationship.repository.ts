import { DeleteCommand, GetCommand, PutCommand, QueryCommand, ScanCommand } from '@aws-sdk/lib-dynamodb';
import { ddbDocClient, INDEXES, TABLES, relationshipKey, DYNAMO_PREFIXES } from '../config/dynamo';
import { RelationshipType, UserId, UserRelationship } from '../models/user.model';

export class RelationshipRepository {
  async follow(userId: UserId, targetUserId: UserId, relationshipType: RelationshipType = 'follow'): Promise<UserRelationship> {
    const createdAt = new Date();

    const keys = relationshipKey(userId, targetUserId, relationshipType.toUpperCase() as any);
    await ddbDocClient.send(
      new PutCommand({
        TableName: TABLES.RELATIONSHIPS,
        Item: {
          ...keys,
          userId,
          targetUserId,
          relationshipType,
          createdAt: createdAt.toISOString(),
        },
        ConditionExpression: 'attribute_not_exists(pk) AND attribute_not_exists(sk)',
      })
    );

    return { userId, targetUserId, relationshipType, createdAt };
  }

  async unfollow(userId: UserId, targetUserId: UserId): Promise<void> {
    const keys = relationshipKey(userId, targetUserId, 'FOLLOW' as any); // Default to follow for deletion if not specified
    await ddbDocClient.send(
      new DeleteCommand({
        TableName: TABLES.RELATIONSHIPS,
        Key: { pk: keys.pk, sk: keys.sk },
      })
    );
  }

  async isFollowing(userId: UserId, targetUserId: UserId): Promise<boolean> {
    const keys = relationshipKey(userId, targetUserId, 'FOLLOW' as any);
    const res = await ddbDocClient.send(
      new GetCommand({
        TableName: TABLES.RELATIONSHIPS,
        Key: { pk: keys.pk, sk: keys.sk },
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
          KeyConditionExpression: 'pk = :pk AND begins_with(sk, :sk_prefix)',
          ExpressionAttributeValues: { 
            ':pk': `${DYNAMO_PREFIXES.user}#${userId}`,
            ':sk_prefix': `${DYNAMO_PREFIXES.relationship}#`
          },
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
            KeyConditionExpression: 'gsi1pk = :tid',
            ExpressionAttributeValues: { ':tid': `${DYNAMO_PREFIXES.user}#${targetUserId}` },
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
            FilterExpression: 'targetUserId = :tid OR gsi1pk = :tid',
            ExpressionAttributeValues: { ':tid': `${DYNAMO_PREFIXES.user}#${targetUserId}` },
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
