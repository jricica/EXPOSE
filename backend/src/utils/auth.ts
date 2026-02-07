import { Request } from 'express';
import { UserContext, UnauthorizedError } from '../types/auth-context';

interface AuthenticatedRequest extends Request {
    context?: UserContext;
}

/**
 * Extrae el contexto de usuario de una Request de Express.
 * Lanza UnauthorizedError si el contexto no está presente.
 */
export const getContext = (req: Request): UserContext => {
    const context = (req as AuthenticatedRequest).context;
    if (!context) {
        throw new UnauthorizedError('Contexto de usuario no disponible');
    }
    return context;
};

/**
 * Helper rápido para obtener el userId del contexto.
 */
export const getUserId = (req: Request): number => {
    return getContext(req).userId;
};
