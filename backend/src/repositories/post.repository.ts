import { Prisma } from '@prisma/client';
import { Post, PostId, LikeRecord } from '../models/post.model';
import { UserId } from '../models/user.model';
import prisma from '../lib/prisma';

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
		const post = await prisma.post.create({
			data: {
				userId: data.userId,
				content: data.content,
				media_url: data.media_url ?? null,
				createdAt: data.createdAt,
				expiresAt: data.expiresAt,
				is_deleted: isDeleted,
			},
			select: {
				id: true,
			},
		});
		return post.id;
	}

	async findById(id: PostId, currentUserId?: UserId): Promise<Post | null> {
		if (currentUserId) {
			const post = await prisma.post.findFirst({
				where: { id, is_deleted: false },
				include: {
					post_likes: {
						where: { userId: currentUserId },
						select: { id: true },
					},
				},
			});

			if (!post) return null;

			const { post_likes, ...basePost } = post;
			return {
				...basePost,
				likedByMe: post_likes.length > 0,
			} as Post;
		}

		const post = await prisma.post.findFirst({
			where: { id, is_deleted: false },
		});

		return post as Post | null;
	}

	async findMany(filters: PostRepositoryFindManyFilters = {}): Promise<Post[]> {
		const { currentUserId } = filters;

		const where: Prisma.PostWhereInput = {
			is_deleted: false,
			...(filters.userId !== undefined ? { userId: filters.userId } : {}),
			...(filters.expiresAfter ? { expiresAt: { gt: filters.expiresAfter } } : {}),
		};

		if (currentUserId) {
			const posts = await prisma.post.findMany({
				where,
				orderBy: { createdAt: 'desc' },
				...(filters.limit !== undefined ? { take: filters.limit } : {}),
				...(filters.offset !== undefined ? { skip: filters.offset } : {}),
				include: {
					post_likes: {
						where: { userId: currentUserId },
						select: { id: true },
					},
				},
			});

			return posts.map((post) => {
				const { post_likes, ...basePost } = post;
				return {
					...basePost,
					likedByMe: post_likes.length > 0,
				} as Post;
			});
		}

		const posts = await prisma.post.findMany({
			where,
			orderBy: { createdAt: 'desc' },
			...(filters.limit !== undefined ? { take: filters.limit } : {}),
			...(filters.offset !== undefined ? { skip: filters.offset } : {}),
		});

		return posts.map((post) => ({
			...post,
			likedByMe: false,
		})) as Post[];
	}

	async countMany(filters: Omit<PostRepositoryFindManyFilters, 'limit' | 'offset' | 'currentUserId'> = {}): Promise<number> {
		return prisma.post.count({
			where: {
				is_deleted: false,
				...(filters.userId !== undefined ? { userId: filters.userId } : {}),
				...(filters.expiresAfter ? { expiresAt: { gt: filters.expiresAfter } } : {}),
			},
		});
	}

	async updateExpiresAt(id: PostId, expiresAt: Date): Promise<void> {
		await prisma.post.updateMany({
			where: {
				id,
				is_deleted: false,
			},
			data: {
				expiresAt,
			},
		});
	}

	async delete(id: PostId): Promise<void> {
  		await prisma.post.update({
			where: { id },
			data: { is_deleted: true },
		});
	}


	async toggleLike(postId: PostId, userId: UserId): Promise<number> {
		return prisma.$transaction(async (tx) => {
			const existing = await tx.postLike.findUnique({
				where: {
					postId_userId: { postId, userId },
				},
			}) as LikeRecord | null;

			if (existing) {
				await tx.postLike.delete({
					where: {
						postId_userId: { postId, userId },
					},
				});
				await tx.post.updateMany({
					where: { id: postId, is_deleted: false },
					data: { likes: { decrement: 1 } },
				});
			} else {
				try {
					await tx.postLike.create({
						data: { postId, userId },
					});
					await tx.post.updateMany({
						where: { id: postId, is_deleted: false },
						data: { likes: { increment: 1 } },
					});
				} catch (error) {
					if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') {
						throw error;
					}
				}
			}

			const updated = await tx.post.findUnique({
				where: { id: postId },
				select: { likes: true },
			});

			return updated?.likes ?? 0;
		});
	}
}

export const postRepository = new PostRepository();
