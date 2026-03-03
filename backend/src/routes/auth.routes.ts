import { Router } from "express";
import { register, login } from "../controllers/auth.controller";
import { validateRegister } from "../middlewares/validateRegister.middleware";

const router = Router();

router.post("/register", validateRegister, register);
router.post("/login", login);

export default router;
