import { query } from "../db/pool";
import { Comment, CommentId } from "../models/comment.model";
import { PostId } from "../models/post.model";
import { UserId } from "../models/user.model";

export class CommentRepository {
  async create(data: { postId: PostId; userId: UserId; content: string }): Promise<CommentId> {
    const result = await query<any>(
      "INSERT INTO comments (postId, userId, content) VALUES (?, ?, ?)",
      [data.postId, data.userId, data.content]
    );
    return result.insertId;
  }

  async findById(id: CommentId): Promise<Comment | null> {
    const results = await query<Comment[]>("SELECT * FROM comments WHERE id = ?", [id]);
    return results.length ? results[0] : null;
  }

  async findByPostId(postId: PostId): Promise<Comment[]> {
    const results = await query<Comment[]>(
      "SELECT * FROM comments WHERE postId = ? ORDER BY createdAt DESC",
      [postId]
    );
    return results;
  }

  async updateContent(id: CommentId, content: string): Promise<void> {
    await query("UPDATE comments SET content = ?, updatedAt = NOW() WHERE id = ?", [content, id]);
  }

  async delete(id: CommentId): Promise<void> {
    await query("DELETE FROM comments WHERE id = ?", [id]);
  }
}

export const commentRepository = new CommentRepository();
