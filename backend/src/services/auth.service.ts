import { pbkdf2Sync, randomBytes, timingSafeEqual } from "crypto";
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

function hashPassword(plain: string): string {
  const salt = randomBytes(16).toString("hex");
  const derived = pbkdf2Sync(plain, salt, 10_000, 64, "sha512").toString("hex");
  return `${salt}:${derived}`;
}

function verifyPassword(plain: string, stored: string): boolean {
  const [salt, original] = stored.split(":");
  if (!salt || !original) return false;

  const derived = pbkdf2Sync(plain, salt, 10_000, 64, "sha512").toString("hex");

  const originalBuf = Buffer.from(original, "hex");
  const derivedBuf = Buffer.from(derived, "hex");
  if (originalBuf.length !== derivedBuf.length) return false;

  return timingSafeEqual(originalBuf, derivedBuf);
}

function toPublicUser(user: User): PublicUser {
  const { id, username, email, createdAt } = user;
  return { id, username, email, createdAt };
}

export async function registerUser(input: RegisterInput): Promise<PublicUser> {
  const username = validateUsername(input.username);
  const email = validateEmail(input.email);

  if (!input.password || input.password.length < 6) {
    throw new Error("Password must be at least 6 characters");
  }

  const duplicate = users.find((u) => u.email === email);
  if (duplicate) {
    throw new Error("Email already registered");
  }

  const passwordHash = hashPassword(input.password);
  const user: User = {
    ...buildUser({ username, email, passwordHash }),
    id: nextId++,
  };

  users.push(user);
  return toPublicUser(user);
}
