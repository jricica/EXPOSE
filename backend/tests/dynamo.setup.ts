import { CreateTableCommand, DynamoDBClient } from '@aws-sdk/client-dynamodb';

const client = new DynamoDBClient({
  region: 'us-east-1',
  endpoint: 'http://localhost:8000',
});

beforeAll(async () => {
  // Tabla de relaciones
  await client.send(new CreateTableCommand({
    TableName: 'Relationships',
    KeySchema: [
      { AttributeName: 'userId', KeyType: 'HASH' },
      { AttributeName: 'targetId', KeyType: 'RANGE' }
    ],
    AttributeDefinitions: [
      { AttributeName: 'userId', AttributeType: 'S' },
      { AttributeName: 'targetId', AttributeType: 'S' }
    ],
    BillingMode: 'PAY_PER_REQUEST'
  }));

  // Tabla de feed
  await client.send(new CreateTableCommand({
    TableName: 'Feed',
    KeySchema: [
      { AttributeName: 'userId', KeyType: 'HASH' },
      { AttributeName: 'postId', KeyType: 'RANGE' }
    ],
    AttributeDefinitions: [
      { AttributeName: 'userId', AttributeType: 'S' },
      { AttributeName: 'postId', AttributeType: 'S' }
    ],
    BillingMode: 'PAY_PER_REQUEST'
  }));
});