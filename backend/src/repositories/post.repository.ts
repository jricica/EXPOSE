import { query } from '../db/pool';
import { Post, PostId, LikeRecord } from '../models/post.model';
import { UserId } from '../models/user.model';

export interface PostRepositoryFindManyFilters {
	userId?: UserId;
	expiresAfter?: Date;
	currentUserId?: UserId;
	limit?: number;
	offset?: number;
}

export class PostRepository {
	async create(
		data: Omit<Post, 'id' | 'likes' | 'likedByMe' | 'is_deleted'> & { is_deleted?: boolean }
	): Promise<PostId> {
		const isDeleted = data.is_deleted ?? false;
		// Ensure reports_count initialized to 0
		const result = await query<any>(
			'INSERT INTO posts (userId, content, media_url, createdAt, expiresAt, is_deleted, reports_count) VALUES (?, ?, ?, ?, ?, ?, ?)',
			[data.userId, data.content, data.media_url || null, data.createdAt, data.expiresAt, isDeleted, 0]
		);
		return result.insertId;
	}

	async findById(id: PostId, currentUserId?: UserId): Promise<Post | null> {
		const sql = currentUserId
			? `SELECT p.*, IF(l.userId IS NOT NULL, 1, 0) as likedByMe 
               FROM posts p 
               LEFT JOIN post_likes l ON p.id = l.postId AND l.userId = ? 
               WHERE p.id = ? AND p.is_deleted = 0`
			: 'SELECT * FROM posts WHERE id = ? AND is_deleted = 0';

		const params = currentUserId ? [currentUserId, id] : [id];
		const results = await query<any[]>(sql, params);

		if (results.length === 0) return null;

		const post = results[0];
		if (currentUserId) {
			post.likedByMe = Boolean(post.likedByMe);
		}
		post.is_deleted = Boolean(post.is_deleted);
		return post as Post;
	}

	async findMany(filters: PostRepositoryFindManyFilters = {}): Promise<Post[]> {
		const { currentUserId } = filters;

		let sql = currentUserId
			? `SELECT p.*, IF(l.userId IS NOT NULL, 1, 0) as likedByMe 
               FROM posts p 
               LEFT JOIN post_likes l ON p.id = l.postId AND l.userId = ? 
               WHERE p.is_deleted = 0`
			: 'SELECT * FROM posts WHERE is_deleted = 0';

		const params: any[] = [];
		if (currentUserId) {
			params.push(currentUserId);
		}

		if (filters.userId) {
			sql += currentUserId ? ' AND p.userId = ?' : ' AND userId = ?';
			params.push(filters.userId);
		}

		if (filters.expiresAfter) {
			sql += currentUserId ? ' AND p.expiresAt > ?' : ' AND expiresAt > ?';
			params.push(filters.expiresAfter);
		}

		sql += currentUserId ? ' ORDER BY p.createdAt DESC' : ' ORDER BY createdAt DESC';
		
		if (filters.limit !== undefined) {
			sql += ' LIMIT ?';
			params.push(filters.limit);
			
			if (filters.offset !== undefined) {
				sql += ' OFFSET ?';
				params.push(filters.offset);
			}
		}

		const results = await query<any[]>(sql, params);

		return results.map(post => ({
			...post,
			likedByMe: currentUserId ? Boolean(post.likedByMe) : false,
			is_deleted: Boolean(post.is_deleted),
		})) as Post[];
	}

	async countMany(filters: Omit<PostRepositoryFindManyFilters, 'limit' | 'offset' | 'currentUserId'> = {}): Promise<number> {
		let sql = 'SELECT COUNT(*) as total FROM posts WHERE is_deleted = 0';
		const params: any[] = [];

		if (filters.userId) {
			sql += ' AND userId = ?';
			params.push(filters.userId);
		}

		if (filters.expiresAfter) {
			sql += ' AND expiresAt > ?';
			params.push(filters.expiresAfter);
		}

		const result = await query<any[]>(sql, params);
		return result[0].total;
	}

	async updateExpiresAt(id: PostId, expiresAt: Date): Promise<void> {
		await query(
			'UPDATE posts SET expiresAt = ? WHERE id = ? AND is_deleted = 0',
			[expiresAt, id]
		);
	}

	async delete(id: PostId): Promise<void> {
	  	await query('UPDATE posts SET is_deleted = 1 WHERE id = ? AND is_deleted = 0', [id]);
	}


	async toggleLike(postId: PostId, userId: UserId): Promise<number> {
		const existing = await query<LikeRecord[]>(
			'SELECT * FROM post_likes WHERE postId = ? AND userId = ?',
			[postId, userId]
		);

		if (existing.length > 0) {
			await query('DELETE FROM post_likes WHERE postId = ? AND userId = ?', [postId, userId]);
			await query('UPDATE posts SET likes = likes - 1 WHERE id = ? AND is_deleted = 0', [postId]);
		} else {
			try {
				await query('INSERT INTO post_likes (postId, userId, createdAt) VALUES (?, ?, NOW())', [postId, userId]);
				await query('UPDATE posts SET likes = likes + 1 WHERE id = ? AND is_deleted = 0', [postId]);
			} catch (error: any) {
				if (error.code !== 'ER_DUP_ENTRY') {
					throw error;
				}
			}
		}

		const updated = await this.findById(postId);
		return updated?.likes ?? 0;
	}

	async incrementReports(postId: PostId): Promise<number | null> {
		// increment reports count atomically and return the new value
		const res = await query<any>(
			'UPDATE posts SET reports_count = reports_count + 1 WHERE id = ? AND is_deleted = 0',
			[postId]
		);

		const rows = await query<any[]>('SELECT reports_count FROM posts WHERE id = ? AND is_deleted = 0', [postId]);
		if (!rows || rows.length === 0) return null;
		return Number(rows[0].reports_count || 0);
	}

	async markExpiredPosts(physicalDelete = false): Promise<number> {
		if (physicalDelete) {
			const res = await query<any>('DELETE FROM posts WHERE expiresAt <= NOW() AND is_deleted = 0');
			return res.affectedRows ?? 0;
		} else {
			const res = await query<any>('UPDATE posts SET is_deleted = 1 WHERE expiresAt <= NOW() AND is_deleted = 0');
			return res.affectedRows ?? 0;
		}
	}
}

export const postRepository = new PostRepository();
