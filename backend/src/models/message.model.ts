import { UserId } from './user.model';

export type ConversationId = string;
export type MessageId = string;

export type ConversationType = 'direct';

export interface ConversationParticipant {
  userId: UserId;
  joinedAt: Date;
  lastReadMessageId?: MessageId;
  lastReadAt?: Date;
}

export interface Conversation {
  conversationId: ConversationId;
  type: ConversationType;
  participantIds: UserId[];
  participants: ConversationParticipant[];
  createdAt: Date;
  updatedAt: Date;
  lastMessageId?: MessageId;
  lastMessageAt?: Date;
  lastMessageSenderId?: UserId;
  lastMessagePreview?: string;
}

export interface Message {
  conversationId: ConversationId;
  messageId: MessageId;
  senderId: UserId;
  receiverId?: UserId;
  content: string;
  createdAt: Date;
  updatedAt?: Date;
  editedAt?: Date | null;
  deletedAt?: Date | null;
  readAt?: Date | null;
}

export interface MessageListQuery {
  limit: number;
  cursorMessageId?: MessageId;
}

export interface PaginatedMessages {
  messages: Message[];
  pagination: {
    limit: number;
    nextCursorMessageId: MessageId | null;
  };
}
