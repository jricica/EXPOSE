import { PutCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { ddbDocClient, TABLES } from '../config/dynamo';
import { Message } from '../models/message.model';

export class MessageRepository {
  async save(message: Message): Promise<void> {
    await ddbDocClient.send(
      new PutCommand({
        TableName: TABLES.MESSAGES,
        Item: {
          conversationId: message.conversationId,
          messageId: message.messageId,
          senderId: message.senderId,
          receiverId: message.receiverId,
          content: message.content,
          createdAt: message.createdAt.toISOString(),
          readAt: message.readAt ? message.readAt.toISOString() : null,
        },
        ConditionExpression: 'attribute_not_exists(conversationId) AND attribute_not_exists(messageId)',
      })
    );
  }

  async list(conversationId: string): Promise<Message[]> {
    const items: any[] = [];
    let lastKey: any;
    do {
      const res = await ddbDocClient.send(
        new QueryCommand({
          TableName: TABLES.MESSAGES,
          KeyConditionExpression: 'conversationId = :cid',
          ExpressionAttributeValues: { ':cid': conversationId },
          ExclusiveStartKey: lastKey,
          ScanIndexForward: true,
        })
      );
      if (res.Items) items.push(...res.Items);
      lastKey = res.LastEvaluatedKey;
    } while (lastKey);

    return items.map((item) => ({
      conversationId: item.conversationId,
      messageId: item.messageId,
      senderId: item.senderId,
      receiverId: item.receiverId,
      content: item.content,
      createdAt: new Date(item.createdAt),
      readAt: item.readAt ? new Date(item.readAt) : null,
    }));
  }
}

export const messageRepository = new MessageRepository();
