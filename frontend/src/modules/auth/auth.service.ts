import { get, post } from "../../../services/api";
import { AuthMeResponse, AuthResponse } from "./auth.types";

export const authService = {
  async login(email: string, password: string): Promise<AuthResponse> {
    try {
      const res = await post<AuthResponse>("/auth/login", { email, password });

      if (!res?.token) {
        throw new Error("Credenciales inválidas");
      }

      return res;
    } catch (error: any) {
      throw new Error(error?.message || "Error al iniciar sesión");
    }
  },

  async register(username: string, email: string, password: string): Promise<AuthResponse> {
    try {
      const user = await post<any>("/auth/register", { username, email, password });

      if (!user.token) {
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