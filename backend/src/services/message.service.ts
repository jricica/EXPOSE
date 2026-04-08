import { v4 as uuidv4 } from 'uuid';
import { Message, ConversationId } from '../models/message.model';
import { UserId } from '../models/user.model';
import { messageRepository, MessageRepository } from '../repositories/message.repository';

const buildConversationId = (a: UserId, b: UserId): ConversationId => {
  const [first, second] = [a, b].sort((x, y) => x - y);
  return `${first}#${second}`;
};

export class MessageService {
  constructor(private readonly repo: MessageRepository = messageRepository) {}

  async sendMessage(senderId: UserId, receiverId: UserId, content: string, conversationId?: ConversationId): Promise<Message> {
    if (!content?.trim()) throw new Error('El mensaje no puede estar vacío');
    const convId = conversationId || buildConversationId(senderId, receiverId);
    const message: Message = {
      conversationId: convId,
      messageId: `${Date.now()}#${uuidv4()}`,
      senderId,
      receiverId,
      content: content.trim(),
      createdAt: new Date(),
      readAt: null,
    };
    await this.repo.save(message);
    return message;
  }

  async listMessages(conversationId: ConversationId): Promise<Message[]> {
    return this.repo.list(conversationId);
  }

  async listWithUser(currentUserId: UserId, otherUserId: UserId): Promise<Message[]> {
    const convId = buildConversationId(currentUserId, otherUserId);
    return this.listMessages(convId);
  }
}

export const messageService = new MessageService();
