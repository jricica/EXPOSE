type LikeRecord = {
	id: string;
	postId: string;
	userId: string;
	createdAt: Date;
};

const likes: LikeRecord[] = [];
const posts: PostRecord[] = [];

import { randomUUID } from "crypto";
import { PostRecord } from "../services/post.service";



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

    async toggleLikeAtomic(postId: string, userId: string): Promise<PostRecord | null> {
	const postIndex = posts.findIndex(p => p.id === postId);
	if (postIndex === -1) return null;

	const likeIndex = likes.findIndex(
		l => l.postId === postId && l.userId === userId
	);

	// Like
	if (likeIndex === -1) {
		likes.push({
			id: randomUUID(),
			postId,
			userId,
			createdAt: new Date(),
		});

		posts[postIndex] = {
			...posts[postIndex],
			likes: posts[postIndex].likes + 1,
		};

		return posts[postIndex];
	}

	// Quitar Like o dislike 
	likes.splice(likeIndex, 1);

	posts[postIndex] = {
		...posts[postIndex],
		likes: Math.max(posts[postIndex].likes - 1, 0),
	};

	return posts[postIndex];
}, 

};


