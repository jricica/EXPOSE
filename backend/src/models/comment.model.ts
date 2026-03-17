import { PostId } from "./post.model";
import { UserId } from "./user.model";

export type CommentId = number;

export interface Comment {
  id: CommentId;
  postId: PostId;
  userId: UserId;
  content: string;
  createdAt: Date;
  updatedAt: Date;
}
