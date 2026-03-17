import { Router } from "express";
import { authMiddleware, optionalAuthMiddleware } from "../middlewares/auth.middleware";
import {
  createComment,
  deleteComment,
  getCommentById,
  listCommentsByPost,
  updateComment,
} from "../controllers/comment.controller";

const router = Router();

router.post("/posts/:postId/comments", authMiddleware, createComment);
router.get("/posts/:postId/comments", optionalAuthMiddleware, listCommentsByPost);
router.get("/comments/:commentId", optionalAuthMiddleware, getCommentById);
router.put("/comments/:commentId", authMiddleware, updateComment);
router.delete("/comments/:commentId", authMiddleware, deleteComment);

export default router;
