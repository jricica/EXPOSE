import { NextFunction, Request, Response } from "express";

const MIN_PASSWORD_LENGTH = 10;
const MAX_PASSWORD_LENGTH = 72; // bcrypt only uses the first 72 bytes
const PASSWORD_COMPLEXITY_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).+$/;
const WEAK_PASSWORDS = new Set([
  "password1!",
  "Password1!",
  "Admin123!",
  "Welcome1!",
  "Qwerty123!",
  "Letmein1!",
  "Iloveyou1!",
  "Abc12345!",
  "Summer23!",
  "Winter23!",
  "Spring23!",
  "Hello123!",
  "Dragon1!",
  "Master1!",
  "Shadow1!",
]);

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

  if (!PASSWORD_COMPLEXITY_REGEX.test(password)) {
    throw new Error(
      "Password must include at least one uppercase letter, one lowercase letter, one number, and one symbol"
    );
  }

  const normalizedPassword = normalizeComparable(password);
  const alphanumericPassword = normalizedPassword.replace(/[^a-z0-9]/g, "");

  if (
    WEAK_PASSWORDS.has(normalizedPassword) ||
    (alphanumericPassword.length > 0 && WEAK_PASSWORDS.has(alphanumericPassword))
  ) {
    throw new Error("Password is too common or weak");
  }

  if (typeof context.email === "string") {
    const normalizedEmail = normalizeComparable(context.email);
    const emailLocalPart = normalizedEmail.split("@")[0] ?? "";
    if (
      normalizedPassword === normalizedEmail ||
      (emailLocalPart.length >= 4 && normalizedPassword.includes(emailLocalPart))
    ) {
      throw new Error("Password cannot be based on your email");
    }
  }

  if (typeof context.username === "string") {
    const normalizedUsername = normalizeComparable(context.username);
    if (
      normalizedPassword === normalizedUsername ||
      (normalizedUsername.length >= 4 && normalizedPassword.includes(normalizedUsername))
    ) {
      throw new Error("Password cannot be based on your username");
    }
  }

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
