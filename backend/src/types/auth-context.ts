import { Request } from 'express';
import { JwtPayload } from 'jsonwebtoken';
import { UserRole } from './roles';

export interface UserContext {
    userId: number;
    email: string;
    username: string;
    role: UserRole;
}

export interface UserJwtPayload extends JwtPayload {
    sub: string;
    email: string;
    role?: string;
}

export interface AuthRequest extends Request {
    context?: UserContext;
    user?: any;
}


export class UnauthorizedError extends Error {
    constructor(message: string = 'No autorizado') {
        super(message);
        this.name = 'UnauthorizedError';
    }
}
