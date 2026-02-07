import { query } from '../db/pool';
import { User, UserId } from '../models/user.model';

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
            'SELECT id, username, email, passwordHash, createdAt FROM users WHERE id = ?',
            [email]
        );

        return results.length > 0 ? results[0] : null;
    }
}
