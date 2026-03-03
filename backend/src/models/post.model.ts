import { UserId } from "./user.model";

export type PostId = number;

export interface Post {
  id: PostId;
  userId: UserId;
  content: string;
  createdAt: Date;
  expiresAt: Date;
  likes: number;
  likedByMe?: boolean;
  is_deleted?: boolean;
}

// Schema note (pending DB migration):
// ALTER TABLE posts ADD COLUMN is_deleted TINYINT(1) NOT NULL DEFAULT 0;

export interface LikeRecord {
  id: number;
  postId: PostId;
  userId: UserId;
  createdAt: Date;
}
