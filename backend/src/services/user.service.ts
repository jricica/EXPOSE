import { User, CreateUserInput } from '../models/user.model';
import {
  validateEmail as ensureUfmEmail,
  validatePassword as ensureStrongPassword,
} from '../middlewares/validateRegister.middleware';

/**
 * Validaciones básicas
 */

export const USERNAME_REGEX = /^[a-zA-Z0-9_]{3,30}$/;

export function normalizeUsername(username: string): string {
  return username.trim();
}

export function validateUsername(username: string): string {
  const value = normalizeUsername(username);
  if (!USERNAME_REGEX.test(value)) {
    throw new Error("Invalid username: must be 3–30 characters and contain only letters, numbers or '_'");
  }
  return value;
}

export const validateEmail = ensureUfmEmail;

export const validatePassword = ensureStrongPassword;

export class UserService {
  private repo: any;
  constructor(userRepository: any) {
    this.repo = userRepository;
  }

  async registerUserAsync(input: any): Promise<any> {
    const username = validateUsername(input.name || input.username);
    const email = validateEmail(input.email);

    return {
      id: input.id || 100,
      username: username,
      email: email,
      password: input.password,
      role: input.role || 1,
      friends: input.friends || [],
      lastLogin: input.lastLogin ?? null
    };
  }

  async getUserById(id: number) {
    const user = await this.repo.findById(id);
    if (!user) throw new Error("User not found");
    return user;
  }

  async updateUser(id: number, data: any) {
    const existing = await this.repo.findById(id);
    if (!existing) throw new Error("User not found");

    await this.repo.update(id, data);
    return await this.repo.findById(id);
  }

  async deleteUser(id: number) {
    const existing = await this.repo.findById(id);
    if (!existing) throw new Error("User not found");

    await this.repo.delete(id);
  }

}

export function buildUser(input: CreateUserInput): Omit<User, "id"> {
  return {
    username: validateUsername(input.username),
    email: validateEmail(input.email),
    passwordHash: input.passwordHash,
    role: 1,
    friends: [],
    createdAt: new Date(),
    lastLogin: input.lastLogin ?? null,
  };
}
