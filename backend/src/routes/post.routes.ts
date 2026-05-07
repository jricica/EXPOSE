import { Router } from "express";
import { createPost, listPosts, toggleLike, setLike, getPost, deletePost, addComment, listComments, deleteComment, reportComment, repostPost, sharePost, reportPost, subscribeToFeed } from "../controllers/post.controller";
import { authMiddleware, optionalAuthMiddleware } from "../middlewares/auth.middleware";

const router = Router();

router.get("/posts/events", subscribeToFeed);
router.post("/posts", authMiddleware, createPost);
router.get("/posts", optionalAuthMiddleware, listPosts);
router.post("/posts/:id/like", authMiddleware, toggleLike);
router.put("/posts/:id/like", authMiddleware, setLike);
router.post("/posts/:id/comments", authMiddleware, addComment);
router.get("/posts/:id/comments", optionalAuthMiddleware, listComments);
router.delete("/posts/:id/comments/:commentId", authMiddleware, deleteComment);
router.post("/posts/:id/comments/:commentId/report", authMiddleware, reportComment);
router.post("/posts/:id/repost", authMiddleware, repostPost);
router.post("/posts/:id/share", authMiddleware, sharePost);
router.get("/posts/:id", optionalAuthMiddleware, getPost);
router.delete("/posts/:id", authMiddleware, deletePost);
router.post('/posts/:id/report', authMiddleware, reportPost);


export default router;
