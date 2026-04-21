import { dynamoClient } from '../src/config/dynamo';
import { PutItemCommand, QueryCommand } from '@aws-sdk/client-dynamodb';

describe('Dynamo Feed Integration', () => {

  it('should store and retrieve feed items', async () => {

    const userId = 'user1';

    await dynamoClient.send(new PutItemCommand({
      TableName: 'Feed',
      Item: {
        userId: { S: userId },
        postId: { S: 'post1' }
      }
    }));

    const result = await dynamoClient.send(new QueryCommand({
      TableName: 'Feed',
      KeyConditionExpression: 'userId = :uid',
      ExpressionAttributeValues: {
        ':uid': { S: userId }
      }
    }));

    expect(result.Items?.length).toBeGreaterThan(0);
  });

});