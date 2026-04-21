import { createPool } from 'mysql2/promise';
import { databaseConfig } from '../src/config/database';

const pool = createPool(databaseConfig);

beforeAll(async () => {
  await pool.query('SET FOREIGN_KEY_CHECKS = 0');

  await pool.query('TRUNCATE TABLE users');
  await pool.query('TRUNCATE TABLE posts');
  await pool.query('TRUNCATE TABLE messages');
  await pool.query('TRUNCATE TABLE relationships');

  await pool.query('SET FOREIGN_KEY_CHECKS = 1');
});

export default pool;