import { get, put } from '../../../services/api';
import { post } from '../../../services/api';
import { FeedResponse, LikeState, PostComment, PostItem } from './post.types';

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

  async createPost(content: string): Promise<PostItem> {
    return post<PostItem>('/posts', { content });
  },

  async addComment(postId: number, content: string): Promise<PostComment> {
    return post<PostComment>(`/posts/${postId}/comments`, { content });
  },
};
