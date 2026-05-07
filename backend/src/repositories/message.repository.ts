import { GetCommand, PutCommand, QueryCommand, ScanCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { ddbDocClient, TABLES } from '../config/dynamo';
import {
  Conversation,
  ConversationId,
  ConversationParticipant,
  Message,
  MessageListQuery,
  PaginatedMessages,
} from '../models/message.model';
import { UserId } from '../models/user.model';

const parseDate = (value?: string | number | Date | null): Date | undefined => {
  if (!value) {
    return undefined;
  }

  return value instanceof Date ? value : new Date(value);
};

const toConversationParticipant = (item: any): ConversationParticipant => ({
  userId: Number(item.userId),
  joinedAt: parseDate(item.joinedAt) ?? new Date(),
  lastReadMessageId: item.lastReadMessageId ? String(item.lastReadMessageId) : undefined,
  lastReadAt: parseDate(item.lastReadAt),
});

const toConversation = (item: any): Conversation => ({
  conversationId: String(item.conversationId),
  type: 'direct',
  participantIds: (item.participantIds ?? []).map((id: unknown) => Number(id)),
  participants: (item.participants ?? []).map((participant: any) => toConversationParticipant(participant)),
  createdAt: parseDate(item.createdAt) ?? new Date(),
  updatedAt: parseDate(item.updatedAt) ?? new Date(),
  lastMessageId: item.lastMessageId ? String(item.lastMessageId) : undefined,
  lastMessageAt: parseDate(item.lastMessageAt),
  lastMessageSenderId: item.lastMessageSenderId !== undefined ? Number(item.lastMessageSenderId) : undefined,
  lastMessagePreview: item.lastMessagePreview ? String(item.lastMessagePreview) : undefined,
});

const toMessage = (item: any): Message => ({
  conversationId: String(item.conversationId),
  messageId: String(item.messageId),
  senderId: Number(item.senderId),
  receiverId: item.receiverId !== undefined ? Number(item.receiverId) : undefined,
  content: String(item.content),
  mediaUrl: item.mediaUrl ? String(item.mediaUrl) : undefined,
  mediaType: item.mediaType ? String(item.mediaType) : undefined,
  createdAt: parseDate(item.createdAt) ?? new Date(),
  updatedAt: parseDate(item.updatedAt),
  editedAt: parseDate(item.editedAt) ?? null,
  deletedAt: parseDate(item.deletedAt) ?? null,
  readAt: parseDate(item.readAt) ?? null,
});

export class MessageRepository {
  async createConversation(conversation: Conversation): Promise<void> {
    await ddbDocClient.send(
      new PutCommand({
        TableName: TABLES.CONVERSATIONS,
        Item: {
          conversationId: conversation.conversationId,
          type: conversation.type,
          participantIds: conversation.participantIds.map(id => String(id)),
          participants: conversation.participants.map((participant) => ({
            userId: String(participant.userId),
            joinedAt: participant.joinedAt.toISOString(),
            lastReadMessageId: participant.lastReadMessageId,
            lastReadAt: participant.lastReadAt ? participant.lastReadAt.toISOString() : null,
          })),
          createdAt: conversation.createdAt.toISOString(),
          updatedAt: conversation.updatedAt.toISOString(),
          lastMessageId: conversation.lastMessageId,
          lastMessageAt: conversation.lastMessageAt ? conversation.lastMessageAt.toISOString() : null,
          lastMessageSenderId: conversation.lastMessageSenderId ? String(conversation.lastMessageSenderId) : null,
          lastMessagePreview: conversation.lastMessagePreview,
        },
        ConditionExpression: 'attribute_not_exists(conversationId)',
      })
    );
  }

  async getConversation(conversationId: ConversationId): Promise<Conversation | null> {
    const result = await ddbDocClient.send(
      new GetCommand({
        TableName: TABLES.CONVERSATIONS,
        Key: { conversationId },
      })
    );

    if (!result.Item) {
      return null;
    }

    return toConversation(result.Item);
  }

  async listConversationsByUser(userId: UserId): Promise<Conversation[]> {
    const items: Conversation[] = [];
    let lastKey: Record<string, unknown> | undefined;

    do {
      const result = await ddbDocClient.send(
        new ScanCommand({
          TableName: TABLES.CONVERSATIONS,
          FilterExpression: 'contains(participantIds, :uid)',
          ExpressionAttributeValues: {
            ':uid': String(userId),
          },
          ExclusiveStartKey: lastKey,
        })
      );

      if (result.Items) {
        items.push(...result.Items.map((item) => toConversation(item)));
      }

      lastKey = result.LastEvaluatedKey as Record<string, unknown> | undefined;
    } while (lastKey);

    return items.sort((a, b) => {
      const aTime = a.lastMessageAt?.getTime() ?? a.updatedAt.getTime();
      const bTime = b.lastMessageAt?.getTime() ?? b.updatedAt.getTime();
      return bTime - aTime;
    });
  }

  async updateConversation(conversation: Conversation): Promise<void> {
    await ddbDocClient.send(
      new PutCommand({
        TableName: TABLES.CONVERSATIONS,
        Item: {
          conversationId: conversation.conversationId,
          type: conversation.type,
          participantIds: conversation.participantIds.map(id => String(id)),
          participants: conversation.participants.map((participant) => ({
            userId: String(participant.userId),
            joinedAt: participant.joinedAt.toISOString(),
            lastReadMessageId: participant.lastReadMessageId,
            lastReadAt: participant.lastReadAt ? participant.lastReadAt.toISOString() : null,
          })),
          createdAt: conversation.createdAt.toISOString(),
          updatedAt: conversation.updatedAt.toISOString(),
          lastMessageId: conversation.lastMessageId,
          lastMessageAt: conversation.lastMessageAt ? conversation.lastMessageAt.toISOString() : null,
          lastMessageSenderId: conversation.lastMessageSenderId ? String(conversation.lastMessageSenderId) : null,
          lastMessagePreview: conversation.lastMessagePreview,
        },
      })
    );
  }

  async save(message: Message): Promise<void> {
    await ddbDocClient.send(
      new PutCommand({
        TableName: TABLES.MESSAGES,
        Item: {
          conversationId: message.conversationId,
          messageId: message.messageId,
          senderId: String(message.senderId),
          receiverId: message.receiverId ? String(message.receiverId) : null,
          content: message.content,
          mediaUrl: message.mediaUrl,
          mediaType: message.mediaType,
          createdAt: message.createdAt.toISOString(),
          updatedAt: message.updatedAt ? message.updatedAt.toISOString() : null,
          editedAt: message.editedAt ? message.editedAt.toISOString() : null,
          deletedAt: message.deletedAt ? message.deletedAt.toISOString() : null,
          readAt: message.readAt ? message.readAt.toISOString() : null,
        },
        ConditionExpression: 'attribute_not_exists(conversationId) AND attribute_not_exists(messageId)',
      })
    );
  }

  async listPaginated(conversationId: string, query: MessageListQuery): Promise<PaginatedMessages> {
    const items: Message[] = [];
    let lastKey: Record<string, unknown> | undefined = query.cursorMessageId
      ? { conversationId, messageId: query.cursorMessageId }
      : undefined;

    do {
      const remaining = query.limit - items.length;
      if (remaining <= 0) {
        break;
      }

      const res = await ddbDocClient.send(
        new QueryCommand({
          TableName: TABLES.MESSAGES,
          KeyConditionExpression: 'conversationId = :cid',
          ExpressionAttributeValues: { ':cid': conversationId },
          ExclusiveStartKey: lastKey,
          ScanIndexForward: false,
          Limit: remaining,
        })
      );

      if (res.Items) {
        items.push(...res.Items.map((item) => toMessage(item)));
      }

      lastKey = res.LastEvaluatedKey as Record<string, unknown> | undefined;
    } while (lastKey && items.length < query.limit);

    return {
      messages: items,
      pagination: {
        limit: query.limit,
        nextCursorMessageId: lastKey?.messageId ? String(lastKey.messageId) : null,
      },
    };
  }

  async markConversationRead(conversationId: ConversationId, userId: UserId, messageId?: string): Promise<void> {
    const conversation = await this.getConversation(conversationId);
    if (!conversation) {
      return;
    }

    const participant = conversation.participants.find((item) => item.userId === userId);
    if (!participant) {
      return;
    }

    let readAt = new Date();
    if (messageId) {
      const messageResult = await ddbDocClient.send(
        new GetCommand({
          TableName: TABLES.MESSAGES,
          Key: { conversationId, messageId },
        })
      );
      if (messageResult.Item?.createdAt) {
        readAt = new Date(messageResult.Item.createdAt);
      }
    } else if (conversation.lastMessageAt) {
      readAt = conversation.lastMessageAt;
    }

    participant.lastReadAt = readAt;
    participant.lastReadMessageId = messageId ?? conversation.lastMessageId;
    conversation.updatedAt = new Date();

    await this.updateConversation(conversation);
  }

  async list(conversationId: string): Promise<Message[]> {
    const result = await this.listPaginated(conversationId, { limit: 100, cursorMessageId: undefined });
    return result.messages;
  }

  async touchConversationAfterSend(conversationId: ConversationId, senderId: UserId, message: Message): Promise<void> {
    const conversation = await this.getConversation(conversationId);
    if (!conversation) {
      return;
    }

    conversation.updatedAt = message.createdAt;
    conversation.lastMessageId = message.messageId;
    conversation.lastMessageAt = message.createdAt;
    conversation.lastMessageSenderId = senderId;
    conversation.lastMessagePreview = message.content.slice(0, 120);

    const senderState = conversation.participants.find((participant) => participant.userId === senderId);
    if (senderState) {
      senderState.lastReadAt = message.createdAt;
      senderState.lastReadMessageId = message.messageId;
    }

    await this.updateConversation(conversation);
  }

  async markMessageRead(conversationId: ConversationId, messageId: string): Promise<void> {
    await ddbDocClient.send(
      new UpdateCommand({
        TableName: TABLES.MESSAGES,
        Key: { conversationId, messageId },
        UpdateExpression: 'SET readAt = :readAt',
        ExpressionAttributeValues: {
          ':readAt': new Date().toISOString(),
        },
        ConditionExpression: 'attribute_exists(conversationId) AND attribute_exists(messageId)',
      })
    ).catch(() => undefined);
  }

  async getMessage(conversationId: ConversationId, messageId: string): Promise<Message | null> {
    const result = await ddbDocClient.send(
      new GetCommand({
        TableName: TABLES.MESSAGES,
        Key: { conversationId, messageId },
      })
    );

    if (!result.Item) {
      return null;
    }

    return toMessage(result.Item);
  }

  async updateMessageContent(conversationId: ConversationId, messageId: string, content: string): Promise<void> {
    const nowIso = new Date().toISOString();
    await ddbDocClient.send(
      new UpdateCommand({
        TableName: TABLES.MESSAGES,
        Key: { conversationId, messageId },
        UpdateExpression: 'SET content = :content, updatedAt = :updatedAt, editedAt = :editedAt',
        ExpressionAttributeValues: {
          ':content': content,
          ':updatedAt': nowIso,
          ':editedAt': nowIso,
        },
        ConditionExpression: 'attribute_exists(conversationId) AND attribute_exists(messageId)',
      })
    );
  }

  async softDeleteMessage(conversationId: ConversationId, messageId: string): Promise<void> {
    const nowIso = new Date().toISOString();
    await ddbDocClient.send(
      new UpdateCommand({
        TableName: TABLES.MESSAGES,
        Key: { conversationId, messageId },
        UpdateExpression: 'SET content = :content, updatedAt = :updatedAt, deletedAt = :deletedAt',
        ExpressionAttributeValues: {
          ':content': '[mensaje eliminado]',
          ':updatedAt': nowIso,
          ':deletedAt': nowIso,
        },
        ConditionExpression: 'attribute_exists(conversationId) AND attribute_exists(messageId)',
      })
    );
  }
}

export const messageRepository = new MessageRepository();
