import { patch, get, postForm } from "../../../services/api";

export interface ProfileUpdateInput {
    display_name?: string;
    bio?: string;
    avatar_url?: string | null;
}

export const profileService = {
    async updateProfile(data: ProfileUpdateInput) {
        return await patch<any>("/auth/me", data);
    },
    
    async getProfile() {
        return await get<any>("/auth/me");
    },

    async uploadAvatar(file: File) {
        const formData = new FormData();
        formData.append('file', file);
        return await postForm<{ url: string }>("/upload/profile-picture", formData);
    }
};
