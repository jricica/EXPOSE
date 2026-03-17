import { patch, get } from "../../../services/api";

export interface ProfileUpdateInput {
    display_name?: string;
    bio?: string;
    avatar_url?: string;
}

export const profileService = {
    async updateProfile(data: ProfileUpdateInput) {
        return await patch<any>("/auth/me", data);
    },
    
    async getProfile() {
        return await get<any>("/auth/me");
    }
};
