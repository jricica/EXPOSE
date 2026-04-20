import { Request, Response } from "express";
import { authService } from "../services/auth.service";
import * as Sentry from "@sentry/node";
import { recordLoginFailure, recordLoginSuccess } from "../middlewares/authRateLimit.middleware";
import { AuthRequest } from "../types/auth-context";

type AuthErrorCode =
  | "validation_error"
  | "invalid_credentials"
  | "email_conflict"
  | "username_conflict"
  | "unique_constraint_violation"
  | "register_failed"
  | "login_failed";

type AuthErrorField = "email" | "username" | "password";

interface AuthErrorPayload {
  error: AuthErrorCode;
  message: string;
  field?: AuthErrorField;
}

const getErrorMessage = (err: unknown, fallback: string): string =>
  err instanceof Error ? err.message : fallback;

const getPrismaUniqueTargets = (err: unknown): string[] => {
  const knownError = err as { code?: string; meta?: { target?: unknown } };
  if (knownError?.code !== "P2002") {
    return [];
  }

  const target = knownError.meta?.target;
  if (Array.isArray(target)) {
    return target.map((entry) => String(entry));
  }
  if (typeof target === "string") {
    return [target];
  }
  return [];
};

const registerErrorResponse = (err: unknown): { status: number; body: AuthErrorPayload } => {
  const message = getErrorMessage(err, "Error en el registro");

  const uniqueTargets = getPrismaUniqueTargets(err);
  if (uniqueTargets.length > 0) {
    const hasEmail = uniqueTargets.some((t) => t.toLowerCase().includes("email"));
    const hasUsername = uniqueTargets.some((t) => t.toLowerCase().includes("username"));

    if (hasEmail && !hasUsername) {
      return {
        status: 409,
        body: { error: "email_conflict", message: "El email ya está registrado", field: "email" },
      };
    }

    if (hasUsername && !hasEmail) {
      return {
        status: 409,
        body: { error: "username_conflict", message: "El username ya está registrado", field: "username" },
      };
    }

    return {
      status: 409,
      body: { error: "unique_constraint_violation", message: "El email o username ya está en uso" },
    };
  }

  if (message === "El email ya está registrado") {
    return {
      status: 409,
      body: { error: "email_conflict", message, field: "email" },
    };
  }

  if (/username/i.test(message) && /(registrado|taken|existe|uso)/i.test(message)) {
    return {
      status: 409,
      body: { error: "username_conflict", message: "El username ya está registrado", field: "username" },
    };
  }

  if (/password/i.test(message)) {
    return {
      status: 400,
      body: { error: "validation_error", message, field: "password" },
    };
  }

  if (/email/i.test(message)) {
    return {
      status: 400,
      body: { error: "validation_error", message, field: "email" },
    };
  }

  if (/username/i.test(message)) {
    return {
      status: 400,
      body: { error: "validation_error", message, field: "username" },
    };
  }

  return {
    status: 500,
    body: { error: "register_failed", message: "Error en el registro" },
  };
};

const loginErrorResponse = (err: unknown): { status: number; body: AuthErrorPayload } => {
  const message = getErrorMessage(err, "Error en el login");

  if (/credenciales inválidas/i.test(message)) {
    return {
      status: 401,
      body: { error: "invalid_credentials", message: "Credenciales inválidas" },
    };
  }

  if (/email|password/i.test(message)) {
    return {
      status: 400,
      body: { error: "validation_error", message },
    };
  }

  return {
    status: 500,
    body: { error: "login_failed", message: "Error en el login" },
  };
};

export const register = async (req: Request, res: Response) => {
  try {
    const response = await authService.register(req.body);
    res.status(201).json(response);
  } catch (err) {
    const mapped = registerErrorResponse(err);
    if (mapped.status >= 500) {
      console.error("Register Error:", err);
      Sentry.captureException(err);
    }
    return res.status(mapped.status).json(mapped.body);
  }
};

export const login = async (req: Request, res: Response) => {
  const loginIdentifier = typeof req.body?.email === "string"
    ? req.body.email
    : req.body?.username;

  try {
    const response = await authService.login(req.body);
    recordLoginSuccess(req, loginIdentifier);
    res.json(response);
  } catch (err) {
    Sentry.captureException(err);
    recordLoginFailure(req, loginIdentifier);
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
