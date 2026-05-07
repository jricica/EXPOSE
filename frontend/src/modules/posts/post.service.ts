import { del, get, postForm, put } from '../../../services/api';
import { post } from '../../../services/api';
import { FeedResponse, LikeState, PostComment, PostCommentsResponse, PostItem } from './post.types';

export type FeedCursor = {
  cursorCreatedAt: string;
  cursorPostId: number;
};

export const postService = {
  async listFeed(limit = 20, cursor?: FeedCursor): Promise<FeedResponse> {
    return get<FeedResponse>('/posts', {
      limit,
      cursorCreatedAt: cursor?.cursorCreatedAt,
      cursorPostId: cursor?.cursorPostId,
    });
  },

  async getPostDetail(postId: number): Promise<PostItem> {
    return get<PostItem>(`/posts/${postId}`);
  },

  async setLike(postId: number, liked: boolean): Promise<LikeState> {
    return put<LikeState>(`/posts/${postId}/like`, { liked });
  },

  async createPost(content: string, options?: { ttlMinutes?: number; mediaUrl?: string }): Promise<PostItem> {
    const ttlMinutes = Math.min(Math.max(options?.ttlMinutes ?? 24 * 60, 1), 24 * 60);

    return post<PostItem>('/posts', {
      content,
      ttl: { minutes: ttlMinutes },
      mediaUrl: options?.mediaUrl,
    });
  },

  async addComment(postId: number, content: string): Promise<PostComment> {
    return post<PostComment>(`/posts/${postId}/comments`, { content });
  },

  async listComments(postId: number): Promise<PostCommentsResponse> {
    return get<PostCommentsResponse>(`/posts/${postId}/comments`, { limit: 50 });
  },

  async deletePost(postId: number): Promise<void> {
    await del<void>(`/posts/${postId}`);
  },

  async uploadPostImage(file: File): Promise<{ url: string }> {
    const formData = new FormData();
    formData.append('file', file);
    return postForm<{ url: string }>('/upload/profile-picture', formData);
  },
};
