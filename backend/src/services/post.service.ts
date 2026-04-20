import * as Sentry from '@sentry/node';
import { Comment, Post, PostId } from '../models/post.model';
import { UserId } from '../models/user.model';
import { postRepository, PostRepository } from '../repositories/post.repository';
import { REPORTS_THRESHOLD } from '../config/env';
import {
	addDuration,
	DurationInput,
	durationIsPositive,
	ensureFutureDate,
	now,
} from '../utils/date';

const DEFAULT_POST_TTL_HOURS = 24;

export interface PostCreateInput {
	userId: UserId;
	content: string;
	ttl?: DurationInput;
	mediaUrl?: string;
}

export interface PostListQuery {
	userId?: UserId;
	includeExpired?: boolean;
	currentUserId?: UserId;
	limit?: number;
	cursorCreatedAt?: Date;
	cursorPostId?: PostId;
}

export interface PaginatedPosts {
	posts: Post[];
	pagination: {
		limit: number;
		nextCursor: {
			cursorCreatedAt: string;
			cursorPostId: PostId;
		} | null;
	};
}

export class PostService {
	constructor(
		private readonly repository: PostRepository = postRepository,
		private readonly clock: () => Date = now
	) { }

	async createPost(input: PostCreateInput): Promise<Post> {
		const createdAt = this.clock();
		const expiresAt = this.resolveExpiration(createdAt, input.ttl);

		const id = await this.repository.create({
			userId: input.userId,
			content: input.content,
			media_url: input.mediaUrl,
			createdAt,
			expiresAt,
		});

		const post = await this.repository.findById(id);
		if (!post) throw new Error('Error al recuperar el post creado');
		return post;
	}

	async listPosts(query: PostListQuery): Promise<PaginatedPosts> {
		const limit = Math.min(Math.max(query.limit || 20, 1), 50);
		const limitPlusOne = limit + 1;

		const filters = {
			userId: query.userId,
			expiresAfter: query.includeExpired ? undefined : this.clock(),
			currentUserId: query.currentUserId,
			limit: limitPlusOne,
			cursorCreatedAt: query.cursorCreatedAt,
			cursorPostId: query.cursorPostId,
		};

		const posts = await this.repository.findMany(filters);

		let nextCursor: { cursorCreatedAt: string; cursorPostId: PostId } | null = null;

		if (posts.length > limit) {
			const last = posts.pop();
			if (last) {
				nextCursor = {
					cursorCreatedAt: last.createdAt instanceof Date
						? last.createdAt.toISOString()
						: String(last.createdAt),
					cursorPostId: last.id,
				};
			}
		}

		return {
			posts,
			pagination: {
				limit,
				nextCursor,
			},
		};
	}

	async toggleLike(postId: PostId, userId: UserId): Promise<number> {
		const post = await this.repository.findById(postId);
		if (!post) throw new Error('Post no encontrado');

		return await this.repository.toggleLike(postId, userId);
	}

	async addComment(postId: PostId, userId: UserId, content: string): Promise<Comment> {
		if (!content?.trim()) throw new Error('El comentario no puede estar vacío');
		const post = await this.repository.findById(postId);
		if (!post) throw new Error('Post no encontrado');
		return this.repository.addComment(postId, userId, content.trim());
	}

	async listComments(postId: PostId): Promise<Comment[]> {
		return this.repository.listComments(postId);
	}

	async sharePost(postId: PostId, userId: UserId): Promise<number> {
		const post = await this.repository.findById(postId);
		if (!post) throw new Error('Post no encontrado');
		return this.repository.share(postId, userId);
	}

	async getPostById(id: PostId, currentUserId?: UserId): Promise<Post> {
  		const post = await this.repository.findById(id, currentUserId);
  		if (!post) throw new Error("Post not found");

  		return post;
	}

	async deletePost(id: PostId): Promise<void> {
  		const post = await this.repository.findById(id);
  		if (!post) throw new Error("Post not found");
		await this.repository.delete(id);
	}

	async reportPost(postId: PostId): Promise<{ reportsCount: number; hidden: boolean }> {
		const post = await this.repository.findById(postId);
		if (!post) throw new Error('Post not found');

		const reports = await this.repository.incrementReports(postId);
		if (reports === null) throw new Error('Post not found or already deleted');

		let hidden = false;
		if (reports >= REPORTS_THRESHOLD) {
			await this.repository.delete(postId);
			hidden = true;
		}

		return { reportsCount: reports, hidden };
	}


	private resolveExpiration(baseDate: Date, ttl?: DurationInput): Date {
		const duration = ttl && durationIsPositive(ttl)
			? ttl
			: { hours: DEFAULT_POST_TTL_HOURS };

		const candidate = addDuration(baseDate, duration);
		return ensureFutureDate(candidate, this.clock());
	}
}

export const postService = new PostService();
