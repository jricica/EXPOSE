import * as Sentry from '@sentry/node';
import { Comment, CommentListQuery, PaginatedComments, Post, PostId } from '../models/post.model';
import { UserId } from '../models/user.model';
import { postRepository, PostLikeState, PostRepository } from '../repositories/post.repository';
import { feedTimelineRepository, FeedTimelineRepository } from '../repositories/feed-timeline.repository';
import { relationshipRepository, RelationshipRepository } from '../repositories/relationship.repository';
import { COMMENT_REPORTS_THRESHOLD, REPORTS_THRESHOLD } from '../config/env';
import { addDuration, DurationInput, durationIsPositive, ensureFutureDate, now } from '../utils/date';
import { containsSensitiveContent } from '../utils/contentFilter';
import { logger } from '../config/logger';

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
    nextCursor: { cursorCreatedAt: string; cursorPostId: PostId } | null;
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
  ) {}

  async createPost(input: PostCreateInput): Promise<Post> {
    logger.info('Creating post', { userId: input.userId, hasMedia: !!input.mediaUrl });

    try {
      const createdAt = this.clock();
      const expiresAt = this.resolveExpiration(createdAt, input.ttl);
      const isSensitive = containsSensitiveContent(input.content);

      const id = await this.repository.create({
        userId: input.userId,
        content: input.content,
        media_url: input.mediaUrl,
        createdAt,
        expiresAt,
        is_sensitive: isSensitive,
      });

      const post = await this.repository.findById(id);
      if (!post) throw new Error('Error al recuperar el post creado');

      await this.publishPostToTimelines(post);
      await this.repository.markFanOutReady(post.id);

      logger.info('Post created successfully', {
        postId: post.id,
        userId: input.userId,
        isSensitive,
        expiresAt: expiresAt.toISOString(),
      });

      return post;
    } catch (error: any) {
      logger.error('Failed to create post', { error: error.message, userId: input.userId });
      throw error;
    }
  }

  async listPosts(query: PostListQuery): Promise<PaginatedPosts> {
    logger.debug('Listing posts', {
      userId: query.userId,
      currentUserId: query.currentUserId,
      limit: query.limit,
    });

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
          cursorCreatedAt:
            last.createdAt instanceof Date ? last.createdAt.toISOString() : String(last.createdAt),
          cursorPostId: last.id,
        };
      }
    }

    logger.debug('Posts listed', { count: enrichedPosts.length, hasNextPage: !!nextCursor });

    return { posts: enrichedPosts, pagination: { limit, nextCursor } };
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

    if (!filters.expiresAfter) return posts;

    const expiresAfterMs = filters.expiresAfter.getTime();
    return posts.filter((post) => post.expiresAt.getTime() > expiresAfterMs);
  }

  private async publishPostToTimelines(post: Post): Promise<void> {
    const followers = await this.relationships.listFollowers(post.userId);
    const followerIds = followers
      .filter((r) => r.relationshipType === 'follow')
      .map((r) => r.userId);

    logger.debug('Fan-out post to timelines', {
      postId: post.id,
      followerCount: followerIds.length,
    });

    await this.timelineRepository.fanOutPostCreated({
      postId: post.id,
      actorUserId: post.userId,
      feedUserIds: [post.userId, ...followerIds],
      createdAt: post.createdAt,
    });
  }

  private async enrichPostsWithDomainMetadata(posts: Post[]): Promise<FeedPost[]> {
    if (posts.length === 0) return [];
    if (!process.env.DATABASE_URL) return posts;

    let users: FeedAuthorProfile[] = [];

    try {
      const { userRepository } = await import('../repositories/user.repository');
      const userIds = posts.map((p) => p.userId);
      users = (await userRepository.findPublicByIds(userIds)) as FeedAuthorProfile[];
    } catch {
      logger.warn('Could not enrich posts with author data, returning raw posts');
      return posts;
    }

    const authorById = new Map<number, FeedAuthorProfile>();
    for (const user of users) authorById.set(user.id, user);

    return posts.map((post) => {
      const author = authorById.get(post.userId);
      return {
        ...post,
        author: author
          ? { id: author.id, username: author.username, displayName: author.display_name, avatarUrl: author.avatar_url }
          : undefined,
      };
    });
  }

  async toggleLike(postId: PostId, userId: UserId): Promise<PostLikeState> {
    logger.info('Toggling like', { postId, userId });
    const post = await this.repository.findById(postId, userId);
    if (!post) throw new Error('Post no encontrado');

    const desiredLikeState = !Boolean(post.likedByMe);
    const result = await this.repository.setLike(postId, userId, desiredLikeState);
    logger.info('Like toggled', { postId, userId, liked: desiredLikeState });
    return result;
  }

  async setLike(postId: PostId, userId: UserId, liked: boolean): Promise<PostLikeState> {
    return this.repository.setLike(postId, userId, liked);
  }

  async addComment(postId: PostId, userId: UserId, content: string): Promise<Comment> {
    const sanitizedContent = content?.trim() ?? '';

    if (sanitizedContent.length < COMMENT_MIN_LENGTH) throw new Error('El comentario no puede estar vacío');
    if (sanitizedContent.length > COMMENT_MAX_LENGTH) throw new Error(`El comentario no puede superar ${COMMENT_MAX_LENGTH} caracteres`);

    const isSensitive = containsSensitiveContent(sanitizedContent);
    const post = await this.repository.findById(postId);
    if (!post) throw new Error('Post no encontrado');

    logger.info('Adding comment', { postId, userId, isSensitive });
    const comment = await this.repository.addComment(postId, userId, sanitizedContent, isSensitive);
    logger.info('Comment added', { postId, commentId: comment.id, userId });
    return comment;
  }

  async listComments(postId: PostId, query: Partial<CommentListQuery> = {}): Promise<PaginatedComments> {
    const limit = Math.min(Math.max(Number(query.limit ?? 20), 1), 50);
    return this.repository.listComments(postId, { limit, cursorCommentId: query.cursorCommentId });
  }

  async reportComment(postId: PostId, commentId: string): Promise<{ reportsCount: number; hidden: boolean }> {
    logger.info('Reporting comment', { postId, commentId });
    const post = await this.repository.findById(postId);
    if (!post) throw new Error('Post no encontrado');

    const comment = await this.repository.reportComment(postId, commentId, COMMENT_REPORTS_THRESHOLD);
    if (!comment) throw new Error('Comentario no encontrado');

    const hidden = comment.moderationStatus === 'hidden';
    if (hidden) logger.warn('Comment hidden after reports threshold', { postId, commentId, reportsCount: comment.reportsCount });

    return { reportsCount: comment.reportsCount, hidden };
  }

  async deleteComment(postId: PostId, commentId: string, actorUserId: UserId): Promise<void> {
    const post = await this.repository.findById(postId);
    if (!post) throw new Error('Post no encontrado');

    const comment = await this.repository.findCommentById(postId, commentId);
    if (!comment) throw new Error('Comentario no encontrado');

    const canDelete = comment.userId === actorUserId || post.userId === actorUserId;
    if (!canDelete) {
      logger.warn('Unauthorized comment deletion attempt', { postId, commentId, actorUserId });
      throw new Error('No autorizado para eliminar este comentario');
    }

    const deleted = await this.repository.deleteComment(postId, commentId);
    if (!deleted) throw new Error('Comentario no encontrado');

    logger.info('Comment deleted', { postId, commentId, actorUserId });
  }

  async sharePost(postId: PostId, userId: UserId): Promise<number> {
    logger.info('Sharing post', { postId, userId });
    const post = await this.repository.findById(postId);
    if (!post) throw new Error('Post no encontrado');
    const shareCount = await this.repository.share(postId, userId);
    logger.info('Post shared', { postId, userId, shareCount });
    return shareCount;
  }

  async repostPost(originalPostId: PostId, actorUserId: UserId, content?: string): Promise<Post> {
    logger.info('Reposting post', { originalPostId, actorUserId });

    const originalPost = await this.repository.findById(originalPostId);
    if (!originalPost) throw new Error('Post original no encontrado');

    if (originalPost.expiresAt.getTime() <= this.clock().getTime()) {
      logger.warn('Attempted repost of expired post', { originalPostId, actorUserId });
      throw new Error('No se puede repostear un post expirado');
    }

    const repostContent = (content?.trim() ?? '') || originalPost.content;
    const isSensitive = containsSensitiveContent(repostContent);
    const rootPostId = originalPost.rootPostId ?? originalPost.id;

    const result = await this.repository.createRepost({
      originalPostId,
      originalAuthorId: originalPost.originalAuthorId ?? originalPost.userId,
      actorUserId,
      content: repostContent,
      expiresAt: originalPost.expiresAt,
      rootPostId,
      is_sensitive: isSensitive,
    });

    const repost = await this.repository.findById(result.repostPostId);
    if (!repost) throw new Error('No se pudo recuperar el repost creado');

    if (result.created) {
      await this.publishPostToTimelines(repost);
      await this.repository.markFanOutReady(repost.id);
    }

    const readyRepost = await this.repository.findById(repost.id);
    if (!readyRepost) throw new Error('No se pudo recuperar el repost final');

    logger.info('Repost created', { repostId: readyRepost.id, originalPostId, actorUserId });
    return readyRepost;
  }

  async getPostById(id: PostId, currentUserId?: UserId): Promise<Post> {
    const post = await this.repository.findById(id, currentUserId);
    if (!post) {
      logger.warn('Post not found', { postId: id, requestedBy: currentUserId });
      throw new Error('Post not found');
    }
    return post;
  }

  async deletePost(id: PostId, actorUserId: UserId): Promise<void> {
    const post = await this.repository.findById(id);
    if (!post) throw new Error('Post not found');

    if (post.userId !== actorUserId) {
      logger.warn('Unauthorized post deletion attempt', { postId: id, actorUserId, ownerId: post.userId });
      throw new Error('No autorizado para eliminar este post');
    }

    await this.repository.delete(id);
    logger.info('Post deleted', { postId: id, actorUserId });
  }

  async reportPost(postId: PostId): Promise<{ reportsCount: number; hidden: boolean }> {
    logger.info('Reporting post', { postId });
    const post = await this.repository.findById(postId);
    if (!post) throw new Error('Post not found');

    const reports = await this.repository.incrementReports(postId);
    if (reports === null) throw new Error('Post not found or already deleted');

    let hidden = false;
    if (reports >= REPORTS_THRESHOLD) {
      await this.repository.delete(postId);
      hidden = true;
      logger.warn('Post hidden and deleted after reports threshold', { postId, reportsCount: reports });
    }

    return { reportsCount: reports, hidden };
  }

  async purgeExpiredPosts(): Promise<{ deleted: number }> {
    logger.info('Purging expired posts');
    const deleted = await this.repository.purgeExpired();
    logger.info('Expired posts purged', { deleted });
    return { deleted };
  }

  private resolveExpiration(baseDate: Date, ttl?: DurationInput): Date {
    const duration = ttl && durationIsPositive(ttl) ? ttl : { hours: DEFAULT_POST_TTL_HOURS };
    const candidate = addDuration(baseDate, duration);
    return ensureFutureDate(candidate, this.clock());
  }
}

export const postService = new PostService();