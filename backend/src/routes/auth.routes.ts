import { Router } from "express";
import { register, login, getMe } from "../controllers/auth.controller";
import { validateRegister } from "../middlewares/validateRegister.middleware";
import { checkLoginLimit } from "../middlewares/authRateLimit.middleware";
import { authMiddleware } from "../middlewares/auth.middleware";

const router = Router();

router.post("/register", validateRegister, register);
router.post("/login", checkLoginLimit, login);
router.get("/me", authMiddleware, getMe);

export default router;
