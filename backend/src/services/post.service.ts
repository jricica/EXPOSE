import "../instrument";
import * as Sentry from '@sentry/node';
import { postRepository } from '../repositories/post.repository';
import { likeRepository } from '../repositories/post.repository';


import {
	addDuration,
	DurationInput,
	durationIsPositive,
	ensureFutureDate,
	hasExpired,
	now,
} from '../utils/date';

const DEFAULT_POST_TTL_HOURS = 24;

type Clock = () => Date;

export interface PostRecord {
	id: string;
	userId: string;
	content: string;
	createdAt: Date;
	expiresAt: Date;
	likes: number;
}

export type PostCreateInput = {
	userId: string;
	content: string;
	ttl?: DurationInput;
	createdAt?: Date;
};

export interface PostQueryFilters {
	userId?: string;
	createdBefore?: Date;
	createdAfter?: Date;
}

export interface PostQuery {
	filters?: PostQueryFilters;
	includeExpired?: boolean;
	limit?: number;
	cursor?: string;
}

export type PostRepositoryCreateData = Omit<PostRecord, 'id'>;

export type PostRepositoryUpdateData =
	Partial<Pick<PostRecord, 'content' | 'expiresAt' | 'likes'>>;

export interface PostRepositoryFindManyInput extends Omit<PostQuery, 'filters'> {
	filters?: PostQueryFilters & {
		expiresAfter?: Date;
	};
}

export interface PostRepository {
	create(data: PostRepositoryCreateData): Promise<PostRecord>;
	findMany(query?: PostRepositoryFindManyInput): Promise<PostRecord[]>;
	findById(id: string): Promise<PostRecord | null>;
	update(id: string, data: PostRepositoryUpdateData): Promise<PostRecord | null>;
}

export interface PostServiceOptions {
	defaultTtl?: DurationInput;
	clock?: Clock;
}

export class PostService {
	private readonly clock: Clock;
	private readonly defaultTtl: DurationInput;

	constructor(
		private readonly repository: PostRepository,
		options: PostServiceOptions = {}
	) {
		this.clock = options.clock ?? now;
		this.defaultTtl =
			options.defaultTtl && durationIsPositive(options.defaultTtl)
				? options.defaultTtl
				: { hours: DEFAULT_POST_TTL_HOURS };
	}

	async createPost(input: PostCreateInput): Promise<PostRecord> {
		try {
			const { userId, content, ttl, createdAt = this.clock() } = input;
			const expiresAt = this.resolveExpiration(createdAt, ttl);

			return await this.repository.create({
				userId,
				content,
				createdAt,
				expiresAt,
				likes: 0,
			});
		} catch (err) {
			Sentry.captureException(err);
			throw err;
		}
	}

	async getPost(
		id: string,
		options?: { includeExpired?: boolean }
	): Promise<PostRecord | null> {
		try {
			const post = await this.repository.findById(id);
			return this.guardExpired(post, options?.includeExpired);
		} catch (err) {
			Sentry.captureException(err);
			throw err;
		}
	}

	async listPosts(query: PostQuery = {}): Promise<PostRecord[]> {
		try {
			return await this.repository.findMany(
				this.withExpirationFilter(query)
			);
		} catch (err) {
			Sentry.captureException(err);
			throw err;
		}
	}

	async refreshExpiration(
		id: string,
		ttl?: DurationInput
	): Promise<PostRecord | null> {
		try {
			const post = await this.repository.findById(id);
			if (!post) return null;

			if (hasExpired(post.expiresAt, this.clock())) {
				Sentry.captureMessage(
					`Attempt to refresh expired post: ${id}`,
					{ level: 'warning' }
				);
				return null;
			}

			const expiresAt = this.resolveExpiration(this.clock(), ttl);
			return await this.repository.update(id, { expiresAt });
		} catch (err) {
			Sentry.captureException(err);
			throw err;
		}
	}

	async toggleLike(postId: string, userId: string): Promise<PostRecord | null> {
	try {
		const post = await this.repository.findById(postId);
		if (!post) return null;

		const existing = await likeRepository.find(postId, userId);

		if (!existing) {
			await likeRepository.create(postId, userId);

			return await this.repository.update(postId, {
				likes: post.likes + 1,
			});
		}

		await likeRepository.delete(existing.id);

		return await this.repository.update(postId, {
			likes: Math.max(post.likes - 1, 0),
		});
	} catch (err) {
		Sentry.captureException(err);
		throw err;
	}
}


	protected withExpirationFilter(
		query: PostQuery = {}
	): PostRepositoryFindManyInput {
		if (query.includeExpired) {
			return { ...query };
		}

		return {
			...query,
			filters: {
				...query.filters,
				expiresAfter: this.clock(),
			},
		};
	}

	private guardExpired(
		post: PostRecord | null,
		includeExpired = false
	): PostRecord | null {
		if (!post) return null;
		if (includeExpired) return post;
		return hasExpired(post.expiresAt, this.clock()) ? null : post;
	}

	private resolveExpiration(baseDate: Date, ttl?: DurationInput): Date {
		const duration = this.pickDuration(ttl);
		const candidate = addDuration(baseDate, duration);
		return ensureFutureDate(candidate, this.clock());
	}

	private pickDuration(duration?: DurationInput): DurationInput {
		return duration && durationIsPositive(duration)
			? duration
			: this.defaultTtl;
	}
};

export const postService = new PostService(postRepository);

