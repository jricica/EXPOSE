export interface User {
    id: number;
    username: string;
    email: string;
    role: number;
}

export interface AuthResponse {
    user: User;
    token: {
        accessToken: string;
        expiresIn: number;
    };
}
