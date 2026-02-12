import { query } from '../db/pool';
import { User, UserId, CreateUserInput } from '../models/user.model';

export class UserRepository {
    static async findById(id: UserId): Promise<User | null> {
        const results = await query<User[]>(
            'SELECT id, username, email, passwordHash, createdAt FROM users WHERE id = ?',
            [id]
        );
        return results.length > 0 ? results[0] : null;
    }

    static async findByEmail(email: string): Promise<User | null> {
        const results = await query<User[]>(
            'SELECT id, username, email, passwordHash, createdAt FROM users WHERE email = ?',
            [email]
        );
        return results.length > 0 ? results[0] : null;
    }

    static async create(user: CreateUserInput): Promise<UserId> {
        const result = await query<any>(
            'INSERT INTO users (username, email, passwordHash, createdAt) VALUES (?, ?, ?, NOW())',
            [user.username, user.email, user.passwordHash]
        );
        return result.insertId;
    }
}
