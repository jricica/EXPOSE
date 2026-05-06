import { Router } from "express";
import { register, login, getMe, updateMe } from "../controllers/auth.controller";
import { requestPasswordReset, resetPassword, changePassword } from "../controllers/auth.extras";
import { validateRegister } from "../middlewares/validateRegister.middleware";
import { checkLoginLimit } from "../middlewares/authRateLimit.middleware";
import { authMiddleware } from "../middlewares/auth.middleware";

const router = Router();

router.post("/register", validateRegister, register);
router.post("/login", checkLoginLimit, login);
router.post("/password/forgot", requestPasswordReset);
router.post("/password/reset", resetPassword);
router.patch("/password", authMiddleware, changePassword);
router.get("/me", authMiddleware, getMe);
router.patch("/me", authMiddleware, updateMe);

export default router;
