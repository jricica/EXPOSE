type LikeRecord = {
	id: string;
	postId: string;
	userId: string;
	createdAt: Date;
};

const likes: LikeRecord[] = [];

import { randomUUID } from "crypto";

export const likeRepository = {
	async find(postId: string, userId: string): Promise<LikeRecord | null> {
		return likes.find(l => l.postId === postId && l.userId === userId) ?? null;
	},

	async create(postId: string, userId: string): Promise<LikeRecord> {
		const like: LikeRecord = {
			id: randomUUID(),
			postId,
			userId,
			createdAt: new Date(),
		};

		likes.push(like);
		return like;
	},

	async delete(id: string): Promise<void> {
		const index = likes.findIndex(l => l.id === id);
		if (index !== -1) likes.splice(index, 1);
	},
};
