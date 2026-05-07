import { del, get, patch, post } from '../../../services/api';

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
  editedAt?: string | null;
  deletedAt?: string | null;
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
    return post<Conversation>('/messages/conversations/direct', { participantUserId });
  },

  async listConversations(): Promise<Conversation[]> {
    return get<Conversation[]>('/messages/conversations');
  },

  async listConversationMessages(conversationId: string, limit = 100): Promise<ConversationMessagesResponse> {
    return get<ConversationMessagesResponse>(`/messages/conversations/${encodeURIComponent(conversationId)}/messages`, { limit });
  },

  async sendConversationMessage(conversationId: string, content: string): Promise<MessageItem> {
    return post<MessageItem>(`/messages/conversations/${encodeURIComponent(conversationId)}/messages`, { content });
  },

  async editConversationMessage(conversationId: string, messageId: string, content: string): Promise<MessageItem> {
    return patch<MessageItem>(`/messages/conversations/${encodeURIComponent(conversationId)}/messages/${encodeURIComponent(messageId)}`, {
      content,
    });
  },

  async deleteConversationMessage(conversationId: string, messageId: string): Promise<void> {
    await del<void>(`/messages/conversations/${encodeURIComponent(conversationId)}/messages/${encodeURIComponent(messageId)}`);
  },

  async searchUsers(search: string): Promise<PublicUser[]> {
    return get<PublicUser[]>('/users', { search });
  },

  async getUserById(userId: number): Promise<PublicUser> {
    return get<PublicUser>(`/users/${userId}`);
  },

  async followUser(userId: number): Promise<void> {
    await post(`/relationships/users/${userId}/follow`);
  },
};
