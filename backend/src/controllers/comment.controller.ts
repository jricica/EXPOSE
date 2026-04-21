import { Request, Response } from "express";
import * as Sentry from "@sentry/node";
import { commentService } from "../services/comment.service";
import { getUserId } from "../utils/auth";

const isValidContent = (content: any): content is string => {
  return typeof content === "string" && content.trim().length > 0;
};

export const createComment = async (req: Request, res: Response) => {
  try {
    const postId = Number(req.params.postId);
    const { content } = req.body;

    if (!isValidContent(content)) {
      return res.status(400).json({ message: "El contenido es obligatorio." });
    }

    const userId = getUserId(req);
    const comment = await commentService.create({
      postId,
      userId,
      content: content.trim(),
    });

    res.status(201).json(comment);
  } catch (err: any) {
    if (err?.message === "Post not found") {
      return res.status(404).json({ message: "Post not found" });
    }
    Sentry.captureException(err);
    res.status(500).json({ message: "Error al crear el comentario." });
  }
};

export const listCommentsByPost = async (req: Request, res: Response) => {
  try {
    const postId = Number(req.params.postId);
    const comments = await commentService.listByPost(postId);
    res.json(comments);
  } catch (err) {
    Sentry.captureException(err);
    res.status(500).json({ message: "Error al listar comentarios." });
  }
};

export const getCommentById = async (req: Request, res: Response) => {
  try {
    const commentId = Number(req.params.commentId);
    const comment = await commentService.getById(commentId);
    res.json(comment);
  } catch (err) {
    Sentry.captureException(err);
    res.status(404).json({ message: "Comment not found" });
  }
};

export const updateComment = async (req: Request, res: Response) => {
  try {
    const commentId = Number(req.params.commentId);
    const { content } = req.body;

    if (!isValidContent(content)) {
      return res.status(400).json({ message: "El contenido es obligatorio." });
    }

    const userId = getUserId(req);
    const updated = await commentService.update(commentId, content.trim(), userId);
    res.json(updated);
  } catch (err: any) {
    if (err?.message === "Comment not found") {
      return res.status(404).json({ message: "Comment not found" });
    }
    if (err?.message === "Forbidden") {
      return res.status(403).json({ message: "Forbidden" });
    }
    Sentry.captureException(err);
    res.status(500).json({ message: "Error al actualizar el comentario." });
  }
};

export const deleteComment = async (req: Request, res: Response) => {
  try {
    const commentId = Number(req.params.commentId);
    const userId = getUserId(req);

    await commentService.delete(commentId, userId);
    res.status(204).send();
  } catch (err: any) {
    if (err?.message === "Comment not found") {
      return res.status(404).json({ message: "Comment not found" });
    }
    if (err?.message === "Forbidden") {
      return res.status(403).json({ message: "Forbidden" });
    }
    Sentry.captureException(err);
    res.status(500).json({ message: "Error al eliminar el comentario." });
  }
};
