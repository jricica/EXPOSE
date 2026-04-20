import { randomUUID } from 'crypto';
import {
  Conversation,
  ConversationId,
  ConversationParticipant,
  Message,
  MessageListQuery,
  PaginatedMessages,
} from '../models/message.model';
import { UserId } from '../models/user.model';
import { messageRepository, MessageRepository } from '../repositories/message.repository';

const buildConversationId = (a: UserId, b: UserId): ConversationId => {
  const [first, second] = [a, b].sort((x, y) => x - y);
  return `${first}#${second}`;
};

export class MessageService {
  constructor(private readonly repo: MessageRepository = messageRepository) {}

  async getOrCreateDirectConversation(userA: UserId, userB: UserId): Promise<Conversation> {
    if (!Number.isInteger(userA) || !Number.isInteger(userB) || userA <= 0 || userB <= 0) {
      throw new Error('Participantes inválidos');
    }

    if (userA === userB) {
      throw new Error('No se puede crear conversación directa con el mismo usuario');
    }

    const conversationId = buildConversationId(userA, userB);
    const existing = await this.repo.getConversation(conversationId);
    if (existing) {
      return existing;
    }

    const now = new Date();
    const participants: ConversationParticipant[] = [
      {
        userId: userA,
        joinedAt: now,
      },
      {
        userId: userB,
        joinedAt: now,
      },
    ];

    const conversation: Conversation = {
      conversationId,
      type: 'direct',
      participantIds: [userA, userB],
      participants,
      createdAt: now,
      updatedAt: now,
    };

    try {
      await this.repo.createConversation(conversation);
    } catch {
      const concurrent = await this.repo.getConversation(conversationId);
      if (concurrent) {
        return concurrent;
      }
      throw new Error('No se pudo crear la conversación');
    }

    return conversation;
  }

  async listConversations(userId: UserId): Promise<Conversation[]> {
    if (!Number.isInteger(userId) || userId <= 0) {
      throw new Error('Usuario inválido');
    }

    return this.repo.listConversationsByUser(userId);
  }

  async sendMessageToConversation(senderId: UserId, conversationId: ConversationId, content: string): Promise<Message> {
    const trimmedContent = content?.trim() ?? '';
    if (!trimmedContent) {
      throw new Error('El mensaje no puede estar vacío');
    }

    const conversation = await this.repo.getConversation(conversationId);
    if (!conversation) {
      throw new Error('Conversación no encontrada');
    }

    if (!conversation.participantIds.includes(senderId)) {
      throw new Error('No autorizado para enviar mensajes en esta conversación');
    }

    const receiverId = conversation.participantIds.find((id) => id !== senderId);
    const message: Message = {
      conversationId,
      messageId: `${Date.now()}#${randomUUID()}`,
      senderId,
      receiverId,
      content: trimmedContent,
      createdAt: new Date(),
      readAt: null,
    };

    await this.repo.save(message);
    await this.repo.touchConversationAfterSend(conversationId, senderId, message);

    return message;
  }

  async sendDirectMessage(senderId: UserId, receiverId: UserId, content: string): Promise<Message> {
    const conversation = await this.getOrCreateDirectConversation(senderId, receiverId);
    return this.sendMessageToConversation(senderId, conversation.conversationId, content);
  }

  async listConversationMessages(
    requesterId: UserId,
    conversationId: ConversationId,
    query: Partial<MessageListQuery> = {},
  ): Promise<PaginatedMessages> {
    const conversation = await this.repo.getConversation(conversationId);
    if (!conversation) {
      throw new Error('Conversación no encontrada');
    }

    if (!conversation.participantIds.includes(requesterId)) {
      throw new Error('No autorizado para ver esta conversación');
    }

    const limit = Math.min(Math.max(Number(query.limit ?? 30), 1), 100);

    return this.repo.listPaginated(conversationId, {
      limit,
      cursorMessageId: query.cursorMessageId,
    });
  }

  async markConversationRead(userId: UserId, conversationId: ConversationId, messageId?: string): Promise<void> {
    const conversation = await this.repo.getConversation(conversationId);
    if (!conversation) {
      throw new Error('Conversación no encontrada');
    }

    if (!conversation.participantIds.includes(userId)) {
      throw new Error('No autorizado para actualizar lectura en esta conversación');
    }

    await this.repo.markConversationRead(conversationId, userId, messageId);
    if (messageId) {
      await this.repo.markMessageRead(conversationId, messageId);
    }
  }

  async sendMessage(senderId: UserId, receiverId: UserId, content: string, conversationId?: ConversationId): Promise<Message> {
    if (conversationId) {
      return this.sendMessageToConversation(senderId, conversationId, content);
    }

    return this.sendDirectMessage(senderId, receiverId, content);
  }

  async listMessages(requesterId: UserId, conversationId: ConversationId): Promise<Message[]> {
    const result = await this.listConversationMessages(requesterId, conversationId, { limit: 100 });
    return result.messages;
  }

  async listWithUser(currentUserId: UserId, otherUserId: UserId): Promise<Message[]> {
    const convId = buildConversationId(currentUserId, otherUserId);
    const result = await this.listConversationMessages(currentUserId, convId, { limit: 100 });
    return result.messages;
  }
}

export const messageService = new MessageService();
