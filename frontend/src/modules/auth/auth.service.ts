import { get, post } from "../../../services/api";
import { AuthMeResponse, AuthResponse } from "./auth.types";

export const authService = {
    async login(email: string, password: string): Promise<AuthResponse> {
        return await post<AuthResponse>("/auth/login", { email, password });
    },

    async register(username: string, email: string, password: string): Promise<AuthResponse> {

        const user = await post<any>("/auth/register", { username, email, password });

        if (!user.token) {
            return await this.login(email, password);
        }
        return user;
    },

    async getMe(): Promise<AuthMeResponse> {
        return await get<AuthMeResponse>("/auth/me");
    }
};
