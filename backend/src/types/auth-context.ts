export interface UserContext {
    userId: number;
    email: string;
    username: string;
    role?: string;
}


export class UnauthorizedError extends Error {
    constructor(message: string = 'No autorizado') {
        super(message);
        this.name = 'UnauthorizedError';
    }
}
