import { Request, Response } from "express";
import { authService } from "../services/auth.service";
import * as Sentry from "@sentry/node";
import { recordLoginFailure, recordLoginSuccess } from "../middlewares/authRateLimit.middleware";
import { AuthRequest } from "../types/auth-context";

export const register = async (req: Request, res: Response) => {
  try {
    const user = await authService.register(req.body);
    res.status(201).json(user);
  } catch (err) {
    console.error("Register Error:", err);
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
    recordLoginSuccess(req);
    res.json(response);
  } catch (err) {
    Sentry.captureException(err);
    recordLoginFailure(req);
    const message = err instanceof Error ? err.message : "Error en el login";
    res.status(401).json({ message });
  }
};

export const getMe = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.context) {
      return res.status(401).json({ error: "unauthorized", message: "No autorizado" });
    }

    const userId = Number(req.context.userId);
    const user = await authService.getUserProfile(userId);
    return res.json({ user });
  } catch (err) {
    if (err instanceof Error && err.message === "Usuario no encontrado") {
      return res.status(401).json({ error: "unauthorized", message: "Usuario no encontrado o inactivo" });
    }

    Sentry.captureException(err);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const updateMe = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.context) {
      return res.status(401).json({ message: "No autorizado" });
    }
    const userId = Number(req.context.userId);
    const { display_name, bio, avatar_url } = req.body;
    
    await authService.updateProfile(userId, { display_name, bio, avatar_url });
    
    const updatedUser = await authService.getUserProfile(userId);
    res.json(updatedUser);
  } catch (err) {
    Sentry.captureException(err);
    res.status(500).json({ message: "Error al actualizar el perfil" });
  }
};
