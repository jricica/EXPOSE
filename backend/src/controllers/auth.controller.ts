import { Request, Response } from "express";
import { authService } from "../services/auth.service";
import * as Sentry from "@sentry/node";

export const register = async (req: Request, res: Response) => {
  try {
    const user = await authService.register(req.body);
    res.status(201).json(user);
  } catch (err) {
    Sentry.captureException(err);
    const message = err instanceof Error ? err.message : "Error en el registro";
    if (message === "User entered an invalid password.") {
      return res.status(400).json({ Code: 1000, Message: message });
    }
    res.status(400).json({ message });
  }
};

export const login = async (req: Request, res: Response) => {
  try {
    const response = await authService.login(req.body);
    res.json(response);
  } catch (err) {
    Sentry.captureException(err);
    const message = err instanceof Error ? err.message : "Error en el login";
    res.status(401).json({ message });
  }
};
