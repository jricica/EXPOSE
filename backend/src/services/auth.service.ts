import * as Sentry from "@sentry/node";
import jwt from "jsonwebtoken";
import { User } from "../models/user.model";
import { userRepository } from "../repositories/user.repository";
import { JWT_SECRET } from "../config/env";
import { UserService, validateEmail, validateUsername, validatePassword } from "./user.service";

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
  authentication_token: string;
}

export class AuthService {
  private userService = new UserService(userRepository);

  async register(input: RegisterInput): Promise<LoginResponse> {
    const username = validateUsername(input.username);
    const email = validateEmail(input.email);
    validatePassword(input.password);

    const user = await this.userService.registerAuthUser({
      username,
      email,
      password: input.password,
    });

    const publicUser = this.userService.getPublicUser(user);
    return this.buildResponse(publicUser);
  }

  async login(input: LoginInput): Promise<LoginResponse> {
    const user = await this.userService.authenticate(input.email, input.password);

    const now = new Date();
    await userRepository.updateLastLogin(user.id, now);
    user.lastLogin = now;

    const publicUser = this.userService.getPublicUser(user);
    return this.buildResponse(publicUser);
  }

  async updateProfile(userId: number, data: { display_name?: string, bio?: string, avatar_url?: string }): Promise<void> {
    await userRepository.update(userId, data);
  }

  async getUserProfile(userId: number): Promise<Omit<User, 'passwordHash'>> {
    const user = await userRepository.findById(userId);
    if (!user) throw new Error("Usuario no encontrado");
    const { passwordHash: _, ...publicUser } = user;
    return publicUser;
  }

  private buildResponse(user: Omit<User, 'passwordHash'>): LoginResponse {
    const accessToken = jwt.sign(
      { sub: user.id.toString(), email: user.email, username: user.username, role: (user as any).role },
      JWT_SECRET,
      { expiresIn: "7d", algorithm: "HS256" }
    );

    return {
      user,
      token: {
        accessToken,
        expiresIn: 7 * 24 * 60 * 60,
      },
      authentication_token: accessToken,
    };
  }
}

export const authService = new AuthService();
