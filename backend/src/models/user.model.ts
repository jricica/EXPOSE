/**
 * Modelo base,y validacion basica, para uso de db en el futuro
 */

export type UserId = number;

/**
 * Estrucutra del usuario
 */

export interface User {
    id: UserId;
    username: string;
    email: string;
    passwordHash: string;
    createdAt: Date;
}

/**
 * Crea el usuario
 */

export interface CreateUserInput {
    username: string;
    email: string;
    passwordHash: string;
}

/**
 * reglas/avisa el texto
 */

export const USERNAME_REGEX = /^[a-zA-Z0-9_]{3,30}$/;

/**
 * Validaciones básicas
 */

export function normalizeUsername(username:string): string {
    return username.trim();
}

export function normalizeEmail(email:string): string {
    return email.trim().toLocaleLowerCase()
}

export function validateUsername(username:string): string {
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
    value.length > 320 ||
    !value.includes("@") ||
    value.startsWith("@") ||
    value.endsWith("@")
  ) {
    throw new Error("Invalid email format");
  }

  return value;
}

export function buildUser(input: CreateUserInput): Omit<User, "id"> {
  return {
    username: validateUsername(input.username),
    email: validateEmail(input.email),
    passwordHash: input.passwordHash,
    createdAt: new Date(),
  };
}