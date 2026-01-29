import * as Sentry from "@sentry/node";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { User } from "../models/user.model";
import { buildUser, validateEmail, validateUsername } from "./user.service";
import { JWT_SECRET } from "../config/env";

export interface RegisterInput {
  username: string;
  email: string;
  password: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface TokenResponse {
  accessToken: string;
  expiresIn: number;
}

export interface LoginResponse {
  user: PublicUser;
  token: TokenResponse;
}

export interface PublicUser {
  id: number;
  username: string;
  email: string;
  createdAt: Date;
}

const users: User[] = [];
let nextId = 1;

function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 10);
}

function generateToken(userId: number, username: string, email: string): TokenResponse {
  try {
    const accessToken = jwt.sign(
      { id: userId, username, email },
      JWT_SECRET,
      { expiresIn: "7d", algorithm: "HS256" }
    );
    
    return {
      accessToken,
      expiresIn: 7 * 24 * 60 * 60, 
    };
  } catch (error) {
    Sentry.captureException(error, {
      tags: { category: "token_generation" },
    });
    throw new Error("Failed to generate token");
  }
}

async function verifyPassword(plain: string, stored: string): Promise<boolean> {
  try {
    return await bcrypt.compare(plain, stored);
  } catch (error) {
    Sentry.captureException(error, {
      tags: { category: "auth_verification" },
    });
    return false;
  }
}

function toPublicUser(user: User): PublicUser {
  const { id, username, email, createdAt } = user;
  return { id, username, email, createdAt };
}

export async function registerUser(input: RegisterInput): Promise<PublicUser> {
  try {
    const username = validateUsername(input.username);
    const email = validateEmail(input.email);

    if (!input.password || input.password.length < 6) {
      const error = new Error("Password must be at least 6 characters");
      Sentry.captureException(error, {
        tags: { category: "validation", field: "password" },
      });
      throw error;
    }

    const duplicate = users.find((u) => u.email === email);
    if (duplicate) {
      const error = new Error("invalid");
      Sentry.captureException(error, {
        tags: { category: "auth", type: "duplicate_email" },
      });
      throw error;
    }

    const passwordHash = await hashPassword(input.password);
    const user: User = {
      ...buildUser({ username, email, passwordHash }),
      id: nextId++,
    };

    users.push(user);
    return toPublicUser(user);
  } catch (error) {
    if (error instanceof Error && error.message === "invalid") {
      throw error;
    }
    Sentry.captureException(error, {
      tags: { category: "auth", operation: "register" },
    });
    throw error;
  }
}

export async function loginUser(input: LoginInput): Promise<LoginResponse> {
  try {
    const email = validateEmail(input.email);

    const user = users.find((u) => u.email === email);
    if (!user) {
      const error = new Error("invalid");
      Sentry.captureException(error, {
        tags: { category: "auth", operation: "login", type: "user_not_found" },
      });
      throw error;
    }

    const isPasswordValid = await verifyPassword(input.password, user.passwordHash);
    if (!isPasswordValid) {
      const error = new Error("invalid");
      Sentry.captureException(error, {
        tags: { category: "auth", operation: "login", type: "invalid_password" },
      });
      throw error;
    }

    const token = generateToken(user.id, user.username, user.email);

    return {
      user: toPublicUser(user),
      token,
    };
  } catch (error) {
    if (error instanceof Error && error.message === "invalid") {
      throw error;
    }
    Sentry.captureException(error, {
      tags: { category: "auth", operation: "login" },
    });
    throw error;
  }
}
