import { Router } from "express";
import { getUser, updateUser, deleteUser } from "../controllers/user.controller";

const router = Router();

router.get("/users/:id", getUser);
router.put("/users/:id", updateUser);
router.delete("/users/:id", deleteUser);

export default router;
