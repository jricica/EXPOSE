import { UserId } from './user.model';

export type ConversationId = string;

export interface Message {
  conversationId: ConversationId;
  messageId: string;
  senderId: UserId;
  receiverId: UserId;
  content: string;
  createdAt: Date;
  readAt?: Date | null;
}
