import { del, get, post, postForm, put } from '../../../services/api';
import { FeedResponse, LikeState, PostComment, PostCommentsResponse, PostItem } from './post.types';

export type FeedCursor = {
  cursorCreatedAt: string;
  cursorPostId: number;
};

export type FeedScope = 'general' | 'following';

export const postService = {
  async listFeed(limit = 20, cursor?: FeedCursor, scope: FeedScope = 'general'): Promise<FeedResponse> {
    return get<FeedResponse>('/posts', {
      limit,
      scope,
      cursorCreatedAt: cursor?.cursorCreatedAt,
      cursorPostId: cursor?.cursorPostId,
    });
  },

  async getPostDetail(postId: number): Promise<PostItem> {
    return get<PostItem>(`/posts/${postId}`);
  },

  async createPost(content: string, options?: { ttlMinutes?: number; mediaUrl?: string }): Promise<PostItem> {
    const ttlMinutes = Math.min(Math.max(options?.ttlMinutes ?? 24 * 60, 1), 24 * 60);

    return post<PostItem>('/posts', {
      content,
      ttl: { minutes: ttlMinutes },
      mediaUrl: options?.mediaUrl,
    });
  },

  async deletePost(postId: number): Promise<void> {
    await del<void>(`/posts/${postId}`);
  },

  async toggleLike(postId: number): Promise<LikeState> {
    return post<LikeState>(`/posts/${postId}/like`, {});
  },

  async setLike(postId: number, liked: boolean): Promise<LikeState> {
    return put<LikeState>(`/posts/${postId}/like`, { liked });
  },

  async addComment(postId: number, content: string): Promise<PostComment> {
    return post<PostComment>(`/posts/${postId}/comments`, { content });
  },

  async listComments(postId: number, cursor?: string, limit = 50): Promise<PostCommentsResponse> {
    return get<PostCommentsResponse>(`/posts/${postId}/comments`, {
      limit,
      cursorCommentId: cursor,
    });
  },

  async deleteComment(postId: number, commentId: string): Promise<void> {
    await del<void>(`/posts/${postId}/comments/${commentId}`);
  },

  async reportComment(postId: number, commentId: string): Promise<void> {
    await post<void>(`/posts/${postId}/comments/${commentId}/report`, {});
  },

  async repostPost(postId: number, content?: string): Promise<PostItem> {
    return post<PostItem>(`/posts/${postId}/repost`, { content });
  },

  async sharePost(postId: number): Promise<{ shares: number }> {
    return post<{ shares: number }>(`/posts/${postId}/share`, {});
  },

  async reportPost(postId: number): Promise<void> {
    await post<void>(`/posts/${postId}/report`, {});
  },

  async uploadPostImage(file: File): Promise<{ url: string }> {
    const formData = new FormData();
    formData.append('file', file);
    return postForm<{ url: string }>('/upload/profile-picture', formData);
  },
};
