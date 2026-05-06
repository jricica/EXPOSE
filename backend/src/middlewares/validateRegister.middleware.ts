import { NextFunction, Request, Response } from "express";

const MIN_PASSWORD_LENGTH = 6;
const MAX_PASSWORD_LENGTH = 72; // bcrypt only uses the first 72 bytes

interface PasswordValidationContext {
  email?: unknown;
  username?: unknown;
}

const normalizeComparable = (value: string): string => value.trim().toLowerCase();

export function validateEmail(email: unknown): string {
  if (typeof email !== "string") {
    throw new Error("Email is required and must be a string");
  }

  const normalized = email.trim().toLowerCase();

  if (
    normalized.length < 3 ||
    normalized.length > 250 ||
    !normalized.includes("@") ||
    normalized.startsWith("@") ||
    normalized.endsWith("@")
  ) {
    throw new Error("Invalid email format");
  }

  if (!normalized.endsWith("@ufm.edu")) {
    throw new Error("Email must end with @ufm.edu");
  }

  return normalized;
}

export function validatePassword(
  password: unknown,
  context: PasswordValidationContext = {}
): string {
  if (typeof password !== "string") {
    throw new Error("Password is required and must be a string");
  }

  if (password.length < MIN_PASSWORD_LENGTH || password.length > MAX_PASSWORD_LENGTH) {
    throw new Error(
      `Password must be between ${MIN_PASSWORD_LENGTH} and ${MAX_PASSWORD_LENGTH} characters`
    );
  }

  // We relaxed the regex and email/username inclusion checks to make it less excessive

  return password;
}

export const validateRegister = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const email = validateEmail(req.body?.email);
    req.body.email = email;
    req.body.password = validatePassword(req.body?.password, {
      email,
      username: req.body?.username,
    });
    return next();
  } catch (err) {
    const message = err instanceof Error ? err.message : "Invalid registration data";
    const field =
      /email/i.test(message) ? "email" :
      /password/i.test(message) ? "password" :
      undefined;

    return res.status(400).json({
      error: "validation_error",
      message,
      ...(field ? { field } : {}),
    });
  }
};
