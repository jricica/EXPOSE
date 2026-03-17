import * as Sentry from '@sentry/node';
import { Post, PostId } from '../models/post.model';
import { UserId } from '../models/user.model';
import { postRepository, PostRepository } from '../repositories/post.repository';
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

	async listPosts(query: PostListQuery): Promise<Post[]> {
		return await this.repository.findMany({
			userId: query.userId,
			expiresAfter: query.includeExpired ? undefined : this.clock(),
			currentUserId: query.currentUserId,
		});
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


	private resolveExpiration(baseDate: Date, ttl?: DurationInput): Date {
		const duration = ttl && durationIsPositive(ttl)
			? ttl
			: { hours: DEFAULT_POST_TTL_HOURS };

		const candidate = addDuration(baseDate, duration);
		return ensureFutureDate(candidate, this.clock());
	}
}

export const postService = new PostService();
