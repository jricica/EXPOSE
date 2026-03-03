import { query } from "../db/pool";
import { User, UserId, CreateUserInput } from "../models/user.model";

export class UserRepository {

    static async findById(id: UserId): Promise<User | null> {
        const results = await query<User[]>(
            "SELECT * FROM users WHERE id = ?",
            [id]
        );
        return results.length ? results[0] : null;
    }

    static async findByEmail(email: string): Promise<User | null> {
        const results = await query<User[]>(
            "SELECT * FROM users WHERE email = ?",
            [email]
        );
        return results.length ? results[0] : null;
    }

    static async create(data: CreateUserInput): Promise<UserId> {
        const result = await query<any>(
            "INSERT INTO users (username, email, passwordHash, lastLogin) VALUES (?, ?, ?, ?)",
            [data.username, data.email, data.passwordHash, data.lastLogin ?? null]
        );
        return result.insertId;
    }

    static async update(id: UserId, data: Partial<User>): Promise<void> {
        await query(
            "UPDATE users SET username = ?, email = ? WHERE id = ?",
            [data.username, data.email, id]
        );
    }

    static async updateLastLogin(id: UserId, date: Date): Promise<void> {
        await query("UPDATE users SET lastLogin = ? WHERE id = ?", [date, id]);
    }

    static async delete(id: UserId): Promise<void> {
        await query("DELETE FROM users WHERE id = ?", [id]);
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
