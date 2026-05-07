import { get, put, post, del } from '../../../services/api';
import { FeedResponse, LikeState, PostComment, PostItem } from './post.types';

export type FeedCursor = {
  cursorCreatedAt: string;
  cursorPostId: number;
};

export type PaginatedComments = {
  comments: PostComment[];
  pagination: { limit: number; nextCursorCommentId: string | null };
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

  async createPost(content: string): Promise<PostItem> {
    return post<PostItem>('/posts', { content });
  },

  async deletePost(postId: number): Promise<void> {
    return del<void>(`/posts/${postId}`);
  },

  async toggleLike(postId: number): Promise<LikeState> {
    return post<LikeState>(`/posts/${postId}/like`, {});
  },

  async setLike(postId: number, liked: boolean): Promise<LikeState> {
    return put<LikeState>(`/posts/${postId}/like`, { liked });
  },

  async listComments(postId: number, cursor?: string, limit = 20): Promise<PaginatedComments> {
    return get<PaginatedComments>(`/posts/${postId}/comments`, {
      limit,
      cursorCommentId: cursor,
    });
  },

  async addComment(postId: number, content: string): Promise<PostComment> {
    return post<PostComment>(`/posts/${postId}/comments`, { content });
  },

  async deleteComment(postId: number, commentId: string): Promise<void> {
    return del<void>(`/posts/${postId}/comments/${commentId}`);
  },

  async reportComment(postId: number, commentId: string): Promise<void> {
    return post<void>(`/posts/${postId}/comments/${commentId}/report`, {});
  },

  async repostPost(postId: number, content?: string): Promise<PostItem> {
    return post<PostItem>(`/posts/${postId}/repost`, { content });
  },

  async sharePost(postId: number): Promise<{ shares: number }> {
    return post<{ shares: number }>(`/posts/${postId}/share`, {});
  },

  async reportPost(postId: number): Promise<void> {
    return post<void>(`/posts/${postId}/report`, {});
  },
};
