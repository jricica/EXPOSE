import * as Sentry from '@sentry/node';
import { Post, PostId } from '../models/post.model';
import { UserId } from '../models/user.model';
import { postRepository, PostRepository } from '../repositories/post.repository';
import { REPORTS_THRESHOLD } from '../config/env';
import {
	addDuration,
	DurationInput,
	durationIsPositive,
	ensureFutureDate,
	hasExpired,
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
	page?: number;
}

export interface PaginatedPosts {
	posts: Post[];
	pagination: {
		total: number;
		limit: number;
		page: number;
		pages: number;
		hasNext: boolean;
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
		const limit = query.limit || 20;
		const page = query.page || 1;
		const offset = (page - 1) * limit;

		const filters = {
			userId: query.userId,
			expiresAfter: query.includeExpired ? undefined : this.clock(),
			currentUserId: query.currentUserId,
			limit,
			offset,
		};

		const [posts, total] = await Promise.all([
			this.repository.findMany(filters),
			this.repository.countMany({
				userId: filters.userId,
				expiresAfter: filters.expiresAfter,
			}),
		]);

		const pages = Math.ceil(total / limit);

		return {
			posts,
			pagination: {
				total,
				limit,
				page,
				pages,
				hasNext: page < pages,
			},
		};
	}

	async toggleLike(postId: PostId, userId: UserId): Promise<number> {
		const post = await this.repository.findById(postId);
		if (!post) throw new Error('Post no encontrado');

		return await this.repository.toggleLike(postId, userId);
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
