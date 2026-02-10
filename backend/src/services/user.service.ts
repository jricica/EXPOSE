import { User, CreateUserInput } from '../models/user.model';

/**
 * Validaciones básicas
 */

export const USERNAME_REGEX = /^[a-zA-Z0-9_]{3,30}$/;

export function normalizeUsername(username: string): string {
  return username.trim();
}

export function normalizeEmail(email: string): string {
  return email.trim().toLocaleLowerCase()
}

export function validateUsername(username: string): string {
  const value = normalizeUsername(username);
  if (!USERNAME_REGEX.test(value)) {
    throw new Error("Invalid username: must be 3–30 characters and contain only letters, numbers or '_'");
  }
  return value;
}

export function validateEmail(email: string): string {
  const value = normalizeEmail(email);

  if (
    value.length < 3 ||
    value.length > 250 ||
    !value.includes("@") ||
    value.startsWith("@") ||
    value.endsWith("@")
  ) {
    throw new Error("Invalid email format");
  }

  return value;
}

export function validatePassword(password: string): string {
  if (password.length < 8) {
    throw new Error("User entered an invalid password.");
  }
  return password;
}

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
      friends: input.friends || []
    };
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
  };
}