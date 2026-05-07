import { UserId } from "./user.model";

export type PostId = number;

export interface Post {
  id: PostId;
  userId: UserId;
  content: string;
  media_url?: string;
  repostOfPostId?: PostId;
  originalAuthorId?: UserId;
  rootPostId?: PostId;
  createdAt: Date;
  expiresAt: Date;
  likes: number;
  commentCount?: number;
  shareCount?: number;
  reportsCount?: number;
  likedByMe?: boolean;
  is_deleted?: boolean;
  is_sensitive?: boolean; 
}

// Schema note (pending DB migration):
// ALTER TABLE posts ADD COLUMN is_deleted TINYINT(1) NOT NULL DEFAULT 0;
// ALTER TABLE posts ADD COLUMN is_sensitive TINYINT(1) NOT NULL DEFAULT 0;

export interface LikeRecord {
  id: number;
  postId: PostId;
  userId: UserId;
  createdAt: Date;
}

export interface Comment {
  commentId: string;
  postId: PostId;
  userId: UserId;
  content: string;
  createdAt: Date;
  updatedAt?: Date;
  moderationStatus: 'active' | 'hidden';
  reportsCount: number;
  moderatedAt?: Date;
  moderationReason?: string;
  is_sensitive?: boolean; 
}

export interface CommentListQuery {
  limit: number;
  cursorCommentId?: string;
}

export interface PaginatedComments {
  comments: Comment[];
  pagination: {
    limit: number;
    nextCursorCommentId: string | null;
  };
}

export interface ShareRecord {
  postId: PostId;
  userId: UserId;
  repostPostId?: PostId;
  createdAt: Date;
}