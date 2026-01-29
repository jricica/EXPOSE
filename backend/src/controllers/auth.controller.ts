import { Request, Response } from "express";
import { registerUser, loginUser } from "../services/auth.service";

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
    const status = message === "Email already registered" ? 409 : 400;

    res.status(status).json({
      success: false,
      message,
      data: null,
    });
  }
}

export async function login(req: Request, res: Response) {
  try {
    const { email, password } = req.body ?? {};
    const result = await loginUser({ email, password });

    res.status(200).json({
      success: true,
      message: "Login successful",
      data: result,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unexpected error";
    res.status(401).json({
      success: false,
      message,
      data: null,
    });
  }
}
