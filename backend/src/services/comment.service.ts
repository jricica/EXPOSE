import { Comment, CommentId } from "../models/comment.model";
import { PostId } from "../models/post.model";
import { UserId } from "../models/user.model";
import { commentRepository, CommentRepository } from "../repositories/comment.repository";
import { postRepository, PostRepository } from "../repositories/post.repository";

export interface CreateCommentInput {
  postId: PostId;
  userId: UserId;
  content: string;
}

export class CommentService {
  constructor(
    private readonly repository: CommentRepository = commentRepository,
    private readonly postRepo: PostRepository = postRepository
  ) { }

  async create(input: CreateCommentInput): Promise<Comment> {
    const post = await this.postRepo.findById(input.postId);
    if (!post) {
      throw new Error("Post not found");
    }

    const id = await this.repository.create({
      postId: input.postId,
      userId: input.userId,
      content: input.content,
    });

    const comment = await this.repository.findById(id);
    if (!comment) throw new Error("Comment not found");

    return comment;
  }

  async listByPost(postId: PostId): Promise<Comment[]> {
    return this.repository.findByPostId(postId);
  }

  async getById(id: CommentId): Promise<Comment> {
    const comment = await this.repository.findById(id);
    if (!comment) throw new Error("Comment not found");
    return comment;
  }

  async update(id: CommentId, content: string, userId?: UserId): Promise<Comment> {
    const existing = await this.repository.findById(id);
    if (!existing) throw new Error("Comment not found");
    if (userId && existing.userId !== userId) {
      throw new Error("Forbidden");
    }

    await this.repository.updateContent(id, content);
    const updated = await this.repository.findById(id);
    if (!updated) throw new Error("Comment not found");

    return updated;
  }

  async delete(id: CommentId, userId?: UserId): Promise<void> {
    const existing = await this.repository.findById(id);
    if (!existing) throw new Error("Comment not found");
    if (userId && existing.userId !== userId) {
      throw new Error("Forbidden");
    }

    await this.repository.delete(id);
  }
}

export const commentService = new CommentService();
