import request from 'supertest';
import app from '../src/app';
import { createPool } from 'mysql2/promise';
import { databaseConfig } from '../src/config/database';

const pool = createPool(databaseConfig);

describe('Auth Integration', () => {

  it('should register user and persist in DB', async () => {

    const user = {
      email: 'integration@test.com',
      password: '123456',
      name: 'testuser'
    };

    const res = await request(app)
      .post('/api/auth/register')
      .send(user);

    expect(res.status).toBe(201);

    expect(res.body).toMatchObject({
      email: user.email,
    });

    // 🔥 validar DB real
    const [rows]: any = await pool.query(
      'SELECT * FROM users WHERE email = ?',
      [user.email]
    );

    expect(rows.length).toBe(1);
    expect(rows[0].email).toBe(user.email);
  });

  it('should fail on duplicate email', async () => {

    const user = {
      email: 'duplicate@test.com',
      password: '123456',
      name: 'user'
    };

    await request(app).post('/api/auth/register').send(user);

    const res = await request(app)
      .post('/api/auth/register')
      .send(user);

    expect(res.status).toBe(400);
  });

});