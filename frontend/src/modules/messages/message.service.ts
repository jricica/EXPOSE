import { get, post } from '../../../services/api';

export type Conversation = {
  conversationId: string;
  participantIds: number[];
  lastMessageAt?: string;
  lastMessagePreview?: string;
  lastMessageSenderId?: number;
};

export type MessageItem = {
  conversationId: string;
  messageId: string;
  senderId: number;
  receiverId?: number;
  content: string;
  createdAt: string;
  readAt?: string | null;
};

export type ConversationMessagesResponse = {
  messages: MessageItem[];
  pagination: {
    limit: number;
    nextCursorMessageId: string | null;
  };
};

export type PublicUser = {
  id: number;
  username: string;
  display_name?: string;
  avatar_url?: string;
};

export const messageService = {
  async createOrGetDirectConversation(participantUserId: number): Promise<Conversation> {
    return post<Conversation>('/conversations/direct', { participantUserId });
  },

  async listConversations(): Promise<Conversation[]> {
    return get<Conversation[]>('/conversations');
  },

  async listConversationMessages(conversationId: string, limit = 100): Promise<ConversationMessagesResponse> {
    return get<ConversationMessagesResponse>(`/conversations/${encodeURIComponent(conversationId)}/messages`, { limit });
  },

  async sendConversationMessage(conversationId: string, content: string): Promise<MessageItem> {
    return post<MessageItem>(`/conversations/${encodeURIComponent(conversationId)}/messages`, { content });
  },

  async searchUsers(search: string): Promise<PublicUser[]> {
    return get<PublicUser[]>('/users', { search });
  },

  async getUserById(userId: number): Promise<PublicUser> {
    return get<PublicUser>(`/users/${userId}`);
  },
};
