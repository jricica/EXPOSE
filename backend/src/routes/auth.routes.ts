import { Router } from "express";
import { register, login } from "../controllers/auth.controller";
import { validateRegister } from "../middlewares/validateRegister.middleware";
import { checkLoginLimit } from "../middlewares/authRateLimit.middleware";

const router = Router();

router.post("/register", validateRegister, register);
router.post("/login", checkLoginLimit, login);

export default router;
