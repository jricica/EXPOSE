import { Request, Response } from "express";
import { postService } from "../services/post.service";
import { getUserId, tryGetUserId } from "../utils/auth";
import * as Sentry from "@sentry/node";

export const createPost = async (req: Request, res: Response) => {
	try {
		const { content, ttl, mediaUrl } = req.body;
		const userId = getUserId(req);

		if (!content) {
			return res.status(400).json({ message: "El contenido es obligatorio." });
		}

		const post = await postService.createPost({
			userId,
			content,
			ttl,
			mediaUrl,
		});

		res.status(201).json(post);
	} catch (err) {
		Sentry.captureException(err);
		res.status(500).json({ message: "Error al crear el post." });
	}
};

export const listPosts = async (req: Request, res: Response) => {
	try {
		const { userId, includeExpired, limit, cursorCreatedAt, cursorPostId } = req.query;
		const currentUserId = tryGetUserId(req);

		if ((cursorCreatedAt && !cursorPostId) || (cursorPostId && !cursorCreatedAt)) {
			return res.status(400).json({ message: "Cursor incompleto." });
		}

		let parsedCursorDate: Date | undefined;
		if (cursorCreatedAt) {
			parsedCursorDate = new Date(String(cursorCreatedAt));
			if (isNaN(parsedCursorDate.getTime())) {
				return res.status(400).json({ message: "cursorCreatedAt inválido." });
			}
		}

		const parsedCursorPostId = cursorPostId ? Number(cursorPostId) : undefined;
		if (cursorPostId && Number.isNaN(parsedCursorPostId)) {
			return res.status(400).json({ message: "cursorPostId inválido." });
		}

		const posts = await postService.listPosts({
			userId: userId ? Number(userId) : undefined,
			includeExpired: includeExpired === "true",
			currentUserId,
			limit: limit ? Number(limit) : undefined,
			cursorCreatedAt: parsedCursorDate,
			cursorPostId: parsedCursorPostId,
		});

		res.json(posts);
	} catch (err) {
		Sentry.captureException(err);
		res.status(500).json({ message: "Error al listar posts." });
	}
};

export const toggleLike = async (req: Request, res: Response) => {
	try {
		const postId = Number(req.params.id);
		const userId = getUserId(req);

		const state = await postService.toggleLike(postId, userId);
		res.json(state);
	} catch (err) {
		Sentry.captureException(err);
		res.status(500).json({ message: "Error al procesar like." });
	}
};

export const setLike = async (req: Request, res: Response) => {
	try {
		const postId = Number(req.params.id);
		if (!Number.isInteger(postId) || postId <= 0) {
			return res.status(400).json({ message: 'ID de post inválido.' });
		}

		const userId = getUserId(req);
		const { liked } = req.body;

		if (typeof liked !== 'boolean') {
			return res.status(400).json({ message: 'El campo liked debe ser booleano.' });
		}

		const state = await postService.setLike(postId, userId, liked);
		res.json(state);
	} catch (err) {
		Sentry.captureException(err);
		if (err instanceof Error && /not found|no encontrado/i.test(err.message)) {
			return res.status(404).json({ message: 'Post no encontrado.' });
		}

		res.status(500).json({ message: 'Error al actualizar like.' });
	}
};

export const addComment = async (req: Request, res: Response) => {
	try {
		const postId = Number(req.params.id);
		const userId = getUserId(req);
		const { content } = req.body;

		const comment = await postService.addComment(postId, userId, content);
		res.status(201).json(comment);
	} catch (err) {
		Sentry.captureException(err);
		res.status(400).json({ message: err instanceof Error ? err.message : "Error al crear comentario." });
	}
};

export const listComments = async (req: Request, res: Response) => {
	try {
		const postId = Number(req.params.id);
		if (!Number.isInteger(postId) || postId <= 0) {
			return res.status(400).json({ message: 'ID de post inválido.' });
		}

		const rawLimit = req.query.limit;
		const rawCursorCommentId = req.query.cursorCommentId;
		const limit = rawLimit ? Number(rawLimit) : undefined;

		if (rawLimit !== undefined && (!Number.isInteger(limit) || Number(limit) <= 0)) {
			return res.status(400).json({ message: 'limit inválido.' });
		}

		const comments = await postService.listComments(postId, {
			limit,
			cursorCommentId: rawCursorCommentId ? String(rawCursorCommentId) : undefined,
		});
		res.json(comments);
	} catch (err) {
		Sentry.captureException(err);
		res.status(500).json({ message: "Error al listar comentarios." });
	}
};

export const reportComment = async (req: Request, res: Response) => {
	try {
		const postId = Number(req.params.id);
		if (!Number.isInteger(postId) || postId <= 0) {
			return res.status(400).json({ message: 'ID de post inválido.' });
		}

		const rawCommentId = req.params.commentId;
		const commentId = Array.isArray(rawCommentId) ? rawCommentId[0] : rawCommentId;
		if (!commentId) {
			return res.status(400).json({ message: 'commentId inválido.' });
		}

		const result = await postService.reportComment(postId, commentId);
		res.json(result);
	} catch (err) {
		Sentry.captureException(err);
		if (err instanceof Error && /no encontrado|not found/i.test(err.message)) {
			return res.status(404).json({ message: err.message });
		}

		res.status(400).json({ message: err instanceof Error ? err.message : 'Error reportando comentario.' });
	}
};

export const sharePost = async (req: Request, res: Response) => {
	try {
		const postId = Number(req.params.id);
		const userId = getUserId(req);

		const shares = await postService.sharePost(postId, userId);
		res.json({ shares });
	} catch (err) {
		Sentry.captureException(err);
		res.status(400).json({ message: err instanceof Error ? err.message : "Error al compartir post." });
	}
};

export const getPost = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const currentUserId = tryGetUserId(req);
    const post = await postService.getPostById(id, currentUserId);
    res.json(post);
  } catch (err) {
    Sentry.captureException(err);
    res.status(404).json({ message: "Post not found" });
  }
};

export const deletePost = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    await postService.deletePost(id);
    res.status(204).send();
  } catch (err) {
    Sentry.captureException(err);
    res.status(404).json({ message: "Post not found" });
  }
};

export const reportPost = async (req: Request, res: Response) => {
	try {
		const id = Number(req.params.id);
		const result = await postService.reportPost(id);
		res.json(result);
	} catch (err) {
		Sentry.captureException(err);
		res.status(400).json({ message: 'Error reporting post' });
	}
};
