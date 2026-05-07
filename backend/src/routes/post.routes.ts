import { Router } from "express";
import { createPost, listPosts, toggleLike, setLike, getPost, deletePost, addComment, listComments, deleteComment, reportComment, repostPost, sharePost, reportPost } from "../controllers/post.controller";
import { authMiddleware, optionalAuthMiddleware } from "../middlewares/auth.middleware";

const router = Router();

router.post("/", authMiddleware, createPost);
router.get("/", optionalAuthMiddleware, listPosts);
router.post("/:id/like", authMiddleware, toggleLike);
router.put("/:id/like", authMiddleware, setLike);
router.post("/:id/comments", authMiddleware, addComment);
router.get("/:id/comments", optionalAuthMiddleware, listComments);
router.delete("/:id/comments/:commentId", authMiddleware, deleteComment);
router.post("/:id/comments/:commentId/report", authMiddleware, reportComment);
router.post("/:id/repost", authMiddleware, repostPost);
router.post("/:id/share", authMiddleware, sharePost);
router.get("/:id", optionalAuthMiddleware, getPost);
router.delete("/:id", authMiddleware, deletePost);
router.post('/:id/report', authMiddleware, reportPost);


export default router;
