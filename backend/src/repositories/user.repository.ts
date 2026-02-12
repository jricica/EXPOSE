import { query } from "../db/pool";
import { User, UserId } from "../models/user.model";

export class UserRepository {

  async findById(id: UserId): Promise<User | null> {
    const results = await query<User[]>(
      "SELECT * FROM users WHERE id = ?",
      [id]
    );
    return results.length ? results[0] : null;
  }

  async update(id: UserId, data: Partial<User>): Promise<void> {
    await query(
      "UPDATE users SET username = ?, email = ? WHERE id = ?",
      [data.username, data.email, id]
    );
  }

  async delete(id: UserId): Promise<void> {
    await query("DELETE FROM users WHERE id = ?", [id]);
  }

  static async update(id: UserId, data: Partial<User>): Promise<void> {
    await query(
        'UPDATE users SET username = ?, email = ? WHERE id = ?',
        [data.username, data.email, id]
    );
  }

static async delete(id: UserId): Promise<void> {
    await query(
        'DELETE FROM users WHERE id = ?',
        [id]
    );
  }
}


export const userRepository = new UserRepository();
