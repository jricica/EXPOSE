import { query } from '../db/pool';
import { Post, PostId, LikeRecord } from '../models/post.model';
import { UserId } from '../models/user.model';

export interface PostRepositoryFindManyFilters {
	userId?: UserId;
	expiresAfter?: Date;
}

export class PostRepository {
	async create(data: Omit<Post, 'id' | 'likes'>): Promise<PostId> {
		const result = await query<any>(
			'INSERT INTO posts (userId, content, createdAt, expiresAt) VALUES (?, ?, ?, ?)',
			[data.userId, data.content, data.createdAt, data.expiresAt]
		);
		return result.insertId;
	}

	async findById(id: PostId): Promise<Post | null> {
		const results = await query<Post[]>(
			'SELECT * FROM posts WHERE id = ?',
			[id]
		);
		return results.length > 0 ? results[0] : null;
	}

	async findMany(filters: PostRepositoryFindManyFilters = {}): Promise<Post[]> {
		let sql = 'SELECT * FROM posts WHERE 1=1';
		const params: any[] = [];

		if (filters.userId) {
			sql += ' AND userId = ?';
			params.push(filters.userId);
		}

		if (filters.expiresAfter) {
			sql += ' AND expiresAt > ?';
			params.push(filters.expiresAfter);
		}

		sql += ' ORDER BY createdAt DESC';

		return await query<Post[]>(sql, params);
	}

	async updateExpiresAt(id: PostId, expiresAt: Date): Promise<void> {
		await query(
			'UPDATE posts SET expiresAt = ? WHERE id = ?',
			[expiresAt, id]
		);
	}

	async toggleLike(postId: PostId, userId: UserId): Promise<number> {
		const existing = await query<LikeRecord[]>(
			'SELECT * FROM post_likes WHERE postId = ? AND userId = ?',
			[postId, userId]
		);

		if (existing.length > 0) {
			await query('DELETE FROM post_likes WHERE postId = ? AND userId = ?', [postId, userId]);
			await query('UPDATE posts SET likes = likes - 1 WHERE id = ?', [postId]);
		} else {
			try {
				await query('INSERT INTO post_likes (postId, userId, createdAt) VALUES (?, ?, NOW())', [postId, userId]);
				await query('UPDATE posts SET likes = likes + 1 WHERE id = ?', [postId]);
			} catch (error: any) {
				if (error.code !== 'ER_DUP_ENTRY') {
					throw error;
				}
			}
		}

		const updated = await this.findById(postId);
		return updated?.likes ?? 0;
	}
}

export const postRepository = new PostRepository();
