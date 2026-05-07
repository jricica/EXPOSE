import { get } from '../../../services/api';

export type PublicUser = {
  id: number;
  username: string;
  display_name?: string;
  avatar_url?: string;
};

export const userService = {
  async searchUsers(search: string): Promise<PublicUser[]> {
    return get<PublicUser[]>('/users', { search });
  },

  async getUserById(userId: number): Promise<PublicUser> {
    return get<PublicUser>(`/users/${userId}`);
  },
};
