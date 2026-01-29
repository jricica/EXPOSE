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
