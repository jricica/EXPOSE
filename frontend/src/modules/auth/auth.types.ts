export interface User {
    id: number;
    username: string;
    email: string;
    display_name?: string;
    bio?: string;
    avatar_url?: string;
    role: number | string;
}

export interface AuthResponse {
    user: User;
    token?: {
        accessToken: string;
        expiresIn: number;
    };
    authentication_token?: string;
}

export interface AuthMeResponse {
    user: User;
}
