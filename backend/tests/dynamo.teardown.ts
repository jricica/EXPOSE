import { DeleteTableCommand, DynamoDBClient } from '@aws-sdk/client-dynamodb';

const client = new DynamoDBClient({
  region: 'us-east-1',
  endpoint: 'http://localhost:8000',
});

afterAll(async () => {
  await client.send(new DeleteTableCommand({ TableName: 'Relationships' }));
  await client.send(new DeleteTableCommand({ TableName: 'Feed' }));
});