export type PostItem = {
  id: number;
  userId: number;
  content: string;
  media_url?: string;
  createdAt: string;
  expiresAt: string;
  likes: number;
  likedByMe: boolean;
  commentCount?: number;
  shareCount?: number;
  reportsCount?: number;
  author?: {
    id: number;
    username: string;
    displayName?: string;
    avatarUrl?: string;
  };
};

export type FeedPagination = {
  limit: number;
  nextCursor: {
    cursorCreatedAt: string;
    cursorPostId: number;
  } | null;
};

export type FeedResponse = {
  posts: PostItem[];
  pagination: FeedPagination;
};

export type LikeState = {
  likes: number;
  likedByMe: boolean;
};

export type PostComment = {
  commentId: string;
  postId: number;
  userId: number;
  content: string;
  createdAt: string;
  moderationStatus?: 'active' | 'hidden';
  reportsCount?: number;
};
