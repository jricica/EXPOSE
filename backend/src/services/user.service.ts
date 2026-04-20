import { User, CreateUserInput } from '../models/user.model';
import {
  validateEmail as ensureUfmEmail,
  validatePassword as ensureStrongPassword,
} from '../middlewares/validateRegister.middleware';
import bcrypt from 'bcrypt';

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

  async registerAuthUser(input: { username: string; email: string; password: string }): Promise<User> {
    const username = validateUsername(input.username);
    const email = validateEmail(input.email);
    validatePassword(input.password);

    const existing = await this.repo.findByEmail(email);
    if (existing) {
      throw new Error("El email ya está registrado");
    }

    const existingUsername = await this.repo.findByUsername(username);
    if (existingUsername) {
      throw new Error("El username ya está registrado");
    }

    const passwordHash = await bcrypt.hash(input.password, 10);
    const userId = await this.repo.create({
      username,
      email,
      passwordHash,
      lastLogin: null,
    });

    const created = await this.repo.findById(userId);
    if (!created) throw new Error("Error al crear usuario");
    return created;
  }

  async authenticate(email: string, password: string): Promise<User> {
    const user = await this.repo.findByEmail(email);
    if (!user) {
      throw new Error("Credenciales inválidas");
    }

    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      throw new Error("Credenciales inválidas");
    }

    return user;
  }

  getPublicUser(user: User): Omit<User, 'passwordHash'> {
    const { passwordHash: _, ...publicUser } = user;
    return publicUser;
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
