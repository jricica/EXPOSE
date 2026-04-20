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
    bio?: string;
    display_name?: string;
    avatar_url?: string;
    role: number;
    friends: UserId[];
    createdAt: Date;
    lastLogin: Date | null;
}

export type RelationshipType = 'follow' | 'blocked' | 'friend';

export interface UserRelationship {
    userId: UserId;
    targetUserId: UserId;
    relationshipType: RelationshipType;
    createdAt: Date;
}

/**
 * Crea el usuario
 */

export interface CreateUserInput {
    username: string;
    email: string;
    passwordHash: string;
    lastLogin?: Date | null;
}
