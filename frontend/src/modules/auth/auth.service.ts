import { get, post } from "../../../services/api";
import { AuthMeResponse, AuthResponse } from "./auth.types";

export const resolveAuthToken = (response: AuthResponse): string => {
  return response.authentication_token ?? response.token?.accessToken ?? '';
};

export const authService = {
  async login(email: string, password: string): Promise<AuthResponse> {
    try {
      const res = await post<AuthResponse>("/auth/login", { email, password });

      if (!resolveAuthToken(res)) {
        throw new Error("Credenciales inválidas");
      }

      return res;
    } catch (error: any) {
      throw new Error(error?.message || "Error al iniciar sesión");
    }
  },

  async register(username: string, email: string, password: string): Promise<AuthResponse> {
    try {
      const user = await post<AuthResponse>("/auth/register", { username, email, password });

      if (!resolveAuthToken(user)) {
        return await this.login(email, password);
      }

      return user;
    } catch (error: any) {
      throw new Error(error?.message || "Error al registrarse");
    }
  },

  async getMe(): Promise<AuthMeResponse> {
    return await get<AuthMeResponse>("/auth/me");
  }
};