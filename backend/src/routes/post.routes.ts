import { Router } from "express";
import { createPost, listPosts, toggleLike, getPost, deletePost, addComment, listComments, sharePost, reportPost } from "../controllers/post.controller";
import { authMiddleware, optionalAuthMiddleware } from "../middlewares/auth.middleware";

const router = Router();

router.post("/posts", authMiddleware, createPost);
router.get("/posts", optionalAuthMiddleware, listPosts);
router.post("/posts/:id/like", authMiddleware, toggleLike);
router.post("/posts/:id/comments", authMiddleware, addComment);
router.get("/posts/:id/comments", optionalAuthMiddleware, listComments);
router.post("/posts/:id/share", authMiddleware, sharePost);
router.get("/posts/:id", optionalAuthMiddleware, getPost);
router.delete("/posts/:id", authMiddleware, deletePost);
router.post('/posts/:id/report', authMiddleware, reportPost);


export default router;
