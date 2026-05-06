import { Router } from "express";
import { searchUsers, getUser, updateUser, deleteUser } from "../controllers/user.controller";
import { authMiddleware } from "../middlewares/auth.middleware";

const router = Router();

router.get("/users", searchUsers);
router.get("/users/:id", getUser);
router.put("/users/:id", authMiddleware, updateUser);
router.delete("/users/:id", authMiddleware, deleteUser);

export default router;
