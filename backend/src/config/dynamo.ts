import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import dotenv from 'dotenv';

dotenv.config();

const region = process.env.AWS_REGION || 'us-east-1';
const endpoint = process.env.AWS_DYNAMO_ENDPOINT; // útil para localstack

const credentials = process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY
  ? {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    }
  : undefined;

const dynamoClient = new DynamoDBClient({
  region,
  endpoint,
  credentials,
});

export const ddbDocClient = DynamoDBDocumentClient.from(dynamoClient, {
  marshallOptions: {
    removeUndefinedValues: true,
    convertClassInstanceToMap: true,
  },
});

export const TABLES = {
  FEED: process.env.DYNAMO_FEED_TABLE || 'FeedItems',
  RELATIONSHIPS: process.env.DYNAMO_REL_TABLE || 'UserRelationships',
  POST_LIKES: process.env.DYNAMO_POST_LIKES_TABLE || 'PostLikes',
  POST_COMMENTS: process.env.DYNAMO_POST_COMMENTS_TABLE || 'PostComments',
  POST_SHARES: process.env.DYNAMO_POST_SHARES_TABLE || 'PostShares',
  MESSAGES: process.env.DYNAMO_MESSAGES_TABLE || 'Messages',
  CONVERSATIONS: process.env.DYNAMO_CONVERSATIONS_TABLE || 'Conversations',
};

export const INDEXES = {
  FEED_USER_CREATED_AT: process.env.DYNAMO_FEED_USER_INDEX || 'UserIdCreatedAtIndex',
  REL_TARGET_USER: process.env.DYNAMO_REL_TARGET_INDEX || 'TargetUserIndex',
};
