import * as Sentry from "@sentry/node";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { User, CreateUserInput } from "../models/user.model";
import { UserRepository } from "../repositories/user.repository";
import { JWT_SECRET } from "../config/env";
import { validateEmail, validateUsername, validatePassword } from "./user.service";

export interface RegisterInput {
  username: string;
  email: string;
  password: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface LoginResponse {
  user: Omit<User, 'passwordHash'>;
  token: {
    accessToken: string;
    expiresIn: number;
  };
}

export class AuthService {
  async register(input: RegisterInput): Promise<Omit<User, 'passwordHash'>> {
    Sentry.captureMessage(`Registering user: ${JSON.stringify({ username: input.username, email: input.email })}`, 'info');
    const username = validateUsername(input.username);
    const email = validateEmail(input.email);
    validatePassword(input.password);

    const existing = await UserRepository.findByEmail(email);
    if (existing) {
      Sentry.captureMessage(`Registration failed: Email already exists ${email}`, 'info');
      throw new Error("El email ya está registrado");
    }

    const passwordHash = await bcrypt.hash(input.password, 10);
    Sentry.captureMessage("Password hashed successfully", 'info');
    const userId = await UserRepository.create({
      username,
      email,
      passwordHash,
    });
    Sentry.captureMessage(`User created in DB with ID: ${userId}`, 'info');

    const user = await UserRepository.findById(userId);
    if (!user) throw new Error("Error al crear usuario");

    const { passwordHash: _, ...publicUser } = user;
    return publicUser;
  }

  async login(input: LoginInput): Promise<LoginResponse> {
    const user = await UserRepository.findByEmail(input.email);
    if (!user) {
      throw new Error("Credenciales inválidas");
    }

    const isPasswordValid = await bcrypt.compare(input.password, user.passwordHash);
    if (!isPasswordValid) {
      throw new Error("Credenciales inválidas");
    }

    const now = new Date();
    await UserRepository.updateLastLogin(user.id, now);
    user.lastLogin = now;

    const accessToken = jwt.sign(
      { sub: user.id.toString(), email: user.email, username: user.username },
      JWT_SECRET,
      { expiresIn: "7d", algorithm: "HS256" }
    );

    const { passwordHash: _, ...publicUser } = user;
    return {
      user: publicUser,
      token: {
        accessToken,
        expiresIn: 7 * 24 * 60 * 60,
      }
    };
  }

  async updateProfile(userId: number, data: { display_name?: string, bio?: string, avatar_url?: string }): Promise<void> {
    await UserRepository.update(userId, data);
  }

  async getUserProfile(userId: number): Promise<Omit<User, 'passwordHash'>> {
    const user = await UserRepository.findById(userId);
    if (!user) throw new Error("Usuario no encontrado");
    const { passwordHash: _, ...publicUser } = user;
    return publicUser;
  }
}

export const authService = new AuthService();
