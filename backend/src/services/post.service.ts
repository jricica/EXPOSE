import * as Sentry from '@sentry/node';
import { Comment, CommentListQuery, PaginatedComments, Post, PostId } from '../models/post.model';
import { UserId } from '../models/user.model';
import { postRepository, PostLikeState, PostRepository } from '../repositories/post.repository';
import { feedTimelineRepository, FeedTimelineRepository } from '../repositories/feed-timeline.repository';
import { relationshipRepository, RelationshipRepository } from '../repositories/relationship.repository';
import { COMMENT_REPORTS_THRESHOLD, REPORTS_THRESHOLD } from '../config/env';
import {
	addDuration,
	DurationInput,
	durationIsPositive,
	ensureFutureDate,
	now,
} from '../utils/date';

const DEFAULT_POST_TTL_HOURS = 24;
const COMMENT_MAX_LENGTH = 500;
const COMMENT_MIN_LENGTH = 1;

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
	posts: FeedPost[];
	pagination: {
		limit: number;
		nextCursor: {
			cursorCreatedAt: string;
			cursorPostId: PostId;
		} | null;
	};
}

export interface FeedPost extends Post {
	author?: {
		id: UserId;
		username: string;
		displayName?: string;
		avatarUrl?: string;
	};
}

interface FeedAuthorProfile {
	id: UserId;
	username: string;
	display_name?: string;
	avatar_url?: string;
}

export class PostService {
	constructor(
		private readonly repository: PostRepository = postRepository,
		private readonly timelineRepository: FeedTimelineRepository = feedTimelineRepository,
		private readonly relationships: RelationshipRepository = relationshipRepository,
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

		await this.publishPostToTimelines(post);
		await this.repository.markFanOutReady(post.id);

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

		const posts = await this.loadFeedPosts(filters);
		const enrichedPosts = await this.enrichPostsWithDomainMetadata(posts);

		let nextCursor: { cursorCreatedAt: string; cursorPostId: PostId } | null = null;

		if (enrichedPosts.length > limit) {
			const last = enrichedPosts.pop();
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
			posts: enrichedPosts,
			pagination: {
				limit,
				nextCursor,
			},
		};
	}

	private async loadFeedPosts(filters: {
		userId?: UserId;
		expiresAfter?: Date;
		currentUserId?: UserId;
		limit: number;
		cursorCreatedAt?: Date;
		cursorPostId?: PostId;
	}): Promise<Post[]> {
		if (filters.userId || !filters.currentUserId) {
			return this.repository.findMany(filters);
		}

		const timelinePostIds = await this.timelineRepository.listPostIds({
			feedUserId: filters.currentUserId,
			limit: filters.limit,
			cursorCreatedAt: filters.cursorCreatedAt,
			cursorPostId: filters.cursorPostId,
		});

		const posts = await this.repository.findByIds(timelinePostIds, filters.currentUserId);

		if (!filters.expiresAfter) {
			return posts;
		}

		const expiresAfterMs = filters.expiresAfter.getTime();
		return posts.filter((post) => post.expiresAt.getTime() > expiresAfterMs);
	}

	private async publishPostToTimelines(post: Post): Promise<void> {
		const followers = await this.relationships.listFollowers(post.userId);
		const followerIds = followers
			.filter((relationship) => relationship.relationshipType === 'follow')
			.map((relationship) => relationship.userId);

		await this.timelineRepository.fanOutPostCreated({
			postId: post.id,
			actorUserId: post.userId,
			feedUserIds: [post.userId, ...followerIds],
			createdAt: post.createdAt,
		});
	}

	private async enrichPostsWithDomainMetadata(posts: Post[]): Promise<FeedPost[]> {
		if (posts.length === 0) {
			return [];
		}

		if (!process.env.DATABASE_URL) {
			return posts;
		}

		let users: FeedAuthorProfile[] = [];

		try {
			const { userRepository } = await import('../repositories/user.repository');
			const userIds = posts.map((post) => post.userId);
			users = await userRepository.findPublicByIds(userIds) as FeedAuthorProfile[];
		} catch {
			return posts;
		}

		const authorById = new Map<number, FeedAuthorProfile>();

		for (const user of users) {
			authorById.set(user.id, user);
		}

		return posts.map((post) => {
			const author = authorById.get(post.userId);

			return {
				...post,
				author: author
					? {
						id: author.id,
						username: author.username,
						displayName: author.display_name,
						avatarUrl: author.avatar_url,
					}
					: undefined,
			};
		});
	}

	async toggleLike(postId: PostId, userId: UserId): Promise<PostLikeState> {
		const post = await this.repository.findById(postId, userId);
		if (!post) throw new Error('Post no encontrado');

		const desiredLikeState = !Boolean(post.likedByMe);
		return this.repository.setLike(postId, userId, desiredLikeState);
	}

	async setLike(postId: PostId, userId: UserId, liked: boolean): Promise<PostLikeState> {
		return this.repository.setLike(postId, userId, liked);
	}

	async addComment(postId: PostId, userId: UserId, content: string): Promise<Comment> {
		const sanitizedContent = content?.trim() ?? '';
		if (sanitizedContent.length < COMMENT_MIN_LENGTH) {
			throw new Error('El comentario no puede estar vacío');
		}

		if (sanitizedContent.length > COMMENT_MAX_LENGTH) {
			throw new Error(`El comentario no puede superar ${COMMENT_MAX_LENGTH} caracteres`);
		}

		const post = await this.repository.findById(postId);
		if (!post) throw new Error('Post no encontrado');
		return this.repository.addComment(postId, userId, sanitizedContent);
	}

	async listComments(postId: PostId, query: Partial<CommentListQuery> = {}): Promise<PaginatedComments> {
		const limit = Math.min(Math.max(Number(query.limit ?? 20), 1), 50);
		const cursorCommentId = query.cursorCommentId;

		return this.repository.listComments(postId, {
			limit,
			cursorCommentId,
		});
	}

	async reportComment(postId: PostId, commentId: string): Promise<{ reportsCount: number; hidden: boolean }> {
		const post = await this.repository.findById(postId);
		if (!post) throw new Error('Post no encontrado');

		const comment = await this.repository.reportComment(postId, commentId, COMMENT_REPORTS_THRESHOLD);
		if (!comment) {
			throw new Error('Comentario no encontrado');
		}

		return {
			reportsCount: comment.reportsCount,
			hidden: comment.moderationStatus === 'hidden',
		};
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
