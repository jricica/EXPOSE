import { UserId } from "./user.model";

export type PostId = number;

export interface Post {
  id: PostId;
  userId: UserId;
  content: string;
  createdAt: Date;
  expiresAt: Date;
  likes: number;
}

export interface LikeRecord {
  id: number;
  postId: PostId;
  userId: UserId;
  createdAt: Date;
}
