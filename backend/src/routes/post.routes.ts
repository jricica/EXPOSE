import { Router } from "express";
import { createPost, listPosts, toggleLike } from "../controllers/post.controller";
import { authMiddleware } from "../middlewares/auth.middleware";

const router = Router();

router.post("/posts", authMiddleware, createPost);
router.get("/posts", listPosts);
router.post("/posts/:id/like", authMiddleware, toggleLike);

export default router;
