import { post } from "../../../services/api";
import { AuthResponse } from "./auth.types";

export const authService = {
    async login(email: string, password: string): Promise<AuthResponse> {
        return await post<AuthResponse>("/auth/login", { email, password });
    },

    async register(username: string, email: string, password: string): Promise<AuthResponse> {
        return await post<AuthResponse>("/auth/register", { username, email, password });
    }
};
