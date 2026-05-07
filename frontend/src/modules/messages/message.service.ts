import { get, post } from "../../../services/api";

export interface Message {
    messageId: string;
    conversationId: string;
    senderId: number;
    content: string;
    mediaUrl?: string;
    mediaType?: string;
    createdAt: string;
}

export interface PostReference {
    postId: number;
    preview?: string;
}

export interface Conversation {
    conversationId: string;
    participantIds: number[];
    lastMessagePreview?: string;
    lastMessageAt?: string;
    updatedAt: string;
}

export const messageService = {
    async listConversations() {
        return await get<Conversation[]>("/messages/conversations");
    },

    async getConversationMessages(conversationId: string) {
        const encodedConversationId = encodeURIComponent(conversationId);
        return await get<{ messages: Message[] }>(`/messages/conversations/${encodedConversationId}/messages`);
    },

    async sendMessage(conversationId: string, content: string, mediaUrl?: string, postReference?: PostReference) {
        const encodedConversationId = encodeURIComponent(conversationId);
        return await post<Message>(`/messages/conversations/${encodedConversationId}/messages`, { content, mediaUrl, postReference });
    },

    async createDirectConversation(participantUserId: number) {
        return await post<Conversation>("/messages/conversations/direct", { participantUserId });
    }
};
