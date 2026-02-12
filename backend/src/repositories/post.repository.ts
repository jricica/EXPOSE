import { query } from '../db/pool';
import { Post, PostId, LikeRecord } from '../models/post.model';
import { UserId } from '../models/user.model';

export interface PostRepositoryFindManyFilters {
	userId?: UserId;
	expiresAfter?: Date;
	currentUserId?: UserId;
}

export class PostRepository {
	async create(data: Omit<Post, 'id' | 'likes' | 'likedByMe'>): Promise<PostId> {
		const result = await query<any>(
			'INSERT INTO posts (userId, content, createdAt, expiresAt) VALUES (?, ?, ?, ?)',
			[data.userId, data.content, data.createdAt, data.expiresAt]
		);
		return result.insertId;
	}

	async findById(id: PostId, currentUserId?: UserId): Promise<Post | null> {
		const sql = currentUserId
			? `SELECT p.*, IF(l.userId IS NOT NULL, 1, 0) as likedByMe 
               FROM posts p 
               LEFT JOIN post_likes l ON p.id = l.postId AND l.userId = ? 
               WHERE p.id = ?`
			: 'SELECT * FROM posts WHERE id = ?';

		const params = currentUserId ? [currentUserId, id] : [id];
		const results = await query<any[]>(sql, params);

		if (results.length === 0) return null;

		const post = results[0];
		if (currentUserId) {
			post.likedByMe = Boolean(post.likedByMe);
		}
		return post as Post;
	}

	async findMany(filters: PostRepositoryFindManyFilters = {}): Promise<Post[]> {
		const { currentUserId } = filters;

		let sql = currentUserId
			? `SELECT p.*, IF(l.userId IS NOT NULL, 1, 0) as likedByMe 
               FROM posts p 
               LEFT JOIN post_likes l ON p.id = l.postId AND l.userId = ? 
               WHERE 1=1`
			: 'SELECT * FROM posts WHERE 1=1';

		const params: any[] = [];
		if (currentUserId) {
			params.push(currentUserId);
		}

		if (filters.userId) {
			sql += ' AND p.userId = ?';
			params.push(filters.userId);
		}

		if (filters.expiresAfter) {
			sql += ' AND p.expiresAt > ?';
			params.push(filters.expiresAfter);
		}

		sql += ' ORDER BY p.createdAt DESC';

		const results = await query<any[]>(sql, params);

		return results.map(post => ({
			...post,
			likedByMe: currentUserId ? Boolean(post.likedByMe) : false
		})) as Post[];
	}

	async updateExpiresAt(id: PostId, expiresAt: Date): Promise<void> {
		await query(
			'UPDATE posts SET expiresAt = ? WHERE id = ?',
			[expiresAt, id]
		);
	}

	async delete(id: PostId): Promise<void> {
  		await query('DELETE FROM posts WHERE id = ?', [id]);
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
