import * as Sentry from "@sentry/node";
import bcrypt from "bcrypt";
import { User } from "../models/user.model";
import { buildUser, validateEmail, validateUsername } from "./user.service";

export interface RegisterInput {
  username: string;
  email: string;
  password: string;
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
