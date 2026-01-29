import { Router } from "express";
import { createPost } from "../controllers/post.controller";
import { listPosts } from "../controllers/post.controller";

const router = Router();

router.post("/posts", createPost);

router.get("/posts", listPosts);


export default router;
