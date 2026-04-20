import { User, UserId, CreateUserInput } from "../models/user.model";
import prisma from "../lib/prisma";

export class UserRepository {

    static async findById(id: UserId): Promise<User | null> {
        const user = await prisma.user.findUnique({
            where: { id }
        });
        return user as User | null;
    }

    static async findByEmail(email: string): Promise<User | null> {
        const user = await prisma.user.findUnique({
            where: { email }
        });
        return user as User | null;
    }

    static async create(data: CreateUserInput): Promise<UserId> {
        const created = await prisma.user.create({
            data: {
                username: data.username,
                email: data.email,
                passwordHash: data.passwordHash,
                lastLogin: data.lastLogin ?? null
            },
            select: { id: true }
        });
        return created.id;
    }

    static async update(id: UserId, data: Partial<User>): Promise<void> {
        const payload: Record<string, unknown> = {};

        if (data.username) payload.username = data.username;
        if (data.email) payload.email = data.email;
        if (data.bio !== undefined) payload.bio = data.bio;
        if (data.display_name !== undefined) payload.display_name = data.display_name;
        if (data.avatar_url !== undefined) payload.avatar_url = data.avatar_url;

        if (Object.keys(payload).length === 0) {
            return;
        }

        await prisma.user.update({
            where: { id },
            data: payload
        });
    }

    static async updateLastLogin(id: UserId, date: Date): Promise<void> {
        await prisma.user.update({
            where: { id },
            data: { lastLogin: date }
        });
    }

    static async delete(id: UserId): Promise<void> {
        await prisma.user.delete({
            where: { id }
        });
    }

    /**
   * Instance methods for compatibility with injected services
   */
    async findById(id: UserId): Promise<User | null> {
        return UserRepository.findById(id);
    }

    async findByEmail(email: string): Promise<User | null> {
        return UserRepository.findByEmail(email);
    }

    async create(data: CreateUserInput): Promise<UserId> {
        return UserRepository.create(data);
    }

    async update(id: UserId, data: Partial<User>): Promise<void> {
        return UserRepository.update(id, data);
    }

    async updateLastLogin(id: UserId, date: Date): Promise<void> {
        return UserRepository.updateLastLogin(id, date);
    }

    async delete(id: UserId): Promise<void> {
        return UserRepository.delete(id);
    }
}

export const userRepository = new UserRepository();
