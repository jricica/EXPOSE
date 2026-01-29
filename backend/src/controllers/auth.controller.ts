import { Request, Response } from "express";
import * as Sentry from "@sentry/node";
import { registerUser } from "../services/auth.service";

export async function register(req: Request, res: Response) {
  try {
    const { username, email, password } = req.body ?? {};
    const user = await registerUser({ username, email, password });

    res.status(201).json({
      success: true,
      message: "User registered",
      data: user,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unexpected error";
    const isInvalidRequest = message === "invalid";
    const status = isInvalidRequest ? 400 : 500;

    // Reportar a Sentry solo errores inesperados (no los de validación)
    if (!isInvalidRequest) {
      Sentry.captureException(err, {
        tags: { category: "auth", operation: "register", error_type: message },
      });
    }

    res.status(status).json({
      success: false,
      message: isInvalidRequest ? "invalid" : "Server error",
      data: null,
    });
  }
}
