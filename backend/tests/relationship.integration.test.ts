import { dynamoClient } from '../src/config/dynamo';
import { PutItemCommand, QueryCommand } from '@aws-sdk/client-dynamodb';

describe('Dynamo Relationships Integration', () => {

  it('should create and retrieve a relationship', async () => {

    const userId = 'user1';
    const targetId = 'user2';

    // insertar relación
    await dynamoClient.send(new PutItemCommand({
      TableName: 'Relationships',
      Item: {
        userId: { S: userId },
        targetId: { S: targetId }
      }
    }));

    // consultar
    const result = await dynamoClient.send(new QueryCommand({
      TableName: 'Relationships',
      KeyConditionExpression: 'userId = :uid',
      ExpressionAttributeValues: {
        ':uid': { S: userId }
      }
    }));

    expect(result.Items?.length).toBe(1);
    expect(result.Items?.[0].targetId.S).toBe(targetId);
  });

});