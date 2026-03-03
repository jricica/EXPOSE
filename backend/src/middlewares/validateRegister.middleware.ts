import { NextFunction, Request, Response } from "express";

const PASSWORD_REGEX = /^(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;

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

export function validatePassword(password: unknown): string {
  if (typeof password !== "string") {
    throw new Error("Password is required and must be a string");
  }

  if (!PASSWORD_REGEX.test(password)) {
    throw new Error(
      "Password must be at least 8 characters and include an uppercase letter, a number, and a symbol"
    );
  }

  return password;
}

export const validateRegister = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    req.body.email = validateEmail(req.body?.email);
    req.body.password = validatePassword(req.body?.password);
    return next();
  } catch (err) {
    const message = err instanceof Error ? err.message : "Invalid registration data";
    return res.status(400).json({ message });
  }
};
