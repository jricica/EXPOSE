import pool from './setup.integration';

afterAll(async () => {
  await pool.end();
});