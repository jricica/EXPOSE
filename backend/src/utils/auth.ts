import { Request } from 'express';
import { UserContext, UnauthorizedError } from '../types/auth-context';

/**
 * Extrae el contexto de usuario de una Request de Express.
 * Lanza UnauthorizedError si el contexto no está presente (por ejemplo, si se olvidó el middleware).
 */
export const getContext = (req: Request): UserContext => {
    if (!req.context) {
        throw new UnauthorizedError('Contexto de usuario no disponible');
    }
    return req.context;
};

/**
 * Helper rápido para obtener solo el userId
 */
export const getUserId = (req: Request): number => {
    return getContext(req).userId;
};
