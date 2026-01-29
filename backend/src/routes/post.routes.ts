import { Router } from "express";
import { createPost } from "../controllers/post.controller";
import { getFeed } from "../controllers/post.controller";

const router = Router();

router.post("/posts", createPost);

router.get("/posts/feed", getFeed);


export default router;
