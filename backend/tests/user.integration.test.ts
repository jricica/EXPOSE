import supertest from 'supertest';
import app from '../src/server';
import { UserRepository, userRepository } from '../src/repositories/user.repository';

jest.mock('../src/config/env', () => ({
    JWT_SECRET: 'test-jwt-secret',
    JWT_ALGORITHM: 'HS256',
    JWT_CLOCK_TOLERANCE_SECONDS: 5,
    REPORTS_THRESHOLD: 5,
    COMMENT_REPORTS_THRESHOLD: 3,
}));

jest.mock('../src/repositories/user.repository');

describe('UserRegister', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('should return token on register and allow immediate authenticated /me request', async () => {
        const createdUser = {
            id: 100,
            username: "testname",
            email: "testname@ufm.edu",
            passwordHash: "hashed",
            role: 1,
            friends: [],
            createdAt: new Date(),
            lastLogin: null,
        };

        (userRepository.findByEmail as jest.Mock).mockResolvedValue(null);
        (userRepository.create as jest.Mock).mockResolvedValue(100);
        (userRepository.findById as jest.Mock).mockResolvedValue(createdUser);
        (UserRepository.findById as jest.Mock).mockResolvedValue(createdUser);

        const registerResponse = await supertest(app).post('/api/auth/register').send({
            "email": "testname@ufm.edu",
            "password": "Password1!",
            "username": "testname"
        })

        expect(registerResponse.status).toBe(201);
        expect(registerResponse.body).toBeDefined();
        expect(registerResponse.body.user.email).toBe("testname@ufm.edu");
        expect(registerResponse.body.token.accessToken).toEqual(expect.any(String));
        expect(registerResponse.body.token.expiresIn).toBeGreaterThan(0);
        expect(registerResponse.body.authentication_token).toBe(registerResponse.body.token.accessToken);

        const meResponse = await supertest(app)
            .get('/api/auth/me')
            .set('Authorization', `Bearer ${registerResponse.body.authentication_token}`);

        expect(meResponse.status).toBe(200);
        expect(meResponse.body.userId).toBe(100);
        expect(meResponse.body.email).toBe("testname@ufm.edu");
        expect(meResponse.body.username).toBe("testname");
    });
  });
});

  it('returns token on register and allows immediate /auth/me bootstrap', async () => {
    const createdUser = {
      id: 100,
      username: 'testname',
      email: 'testname@ufm.edu',
      passwordHash: 'hashed',
      role: 1,
      friends: [],
      createdAt: new Date(),
      lastLogin: null,
    };

        const response = await supertest(app).post('/api/auth/register').send({
            "email": "testname@ufm.edu",
            "password": "test", // < 8 chars
            "username": "testname"
        })

        expect(response.status).toBe(400);
        expect(response.body).toBeDefined();
        expect(response.body.message).toContain("Password must be at least 8 characters");
    });

    expect(registerResponse.status).toBe(201);
    expect(registerResponse.body.user.email).toBe('testname@ufm.edu');
    expect(registerResponse.body.token.accessToken).toEqual(expect.any(String));
    expect(registerResponse.body.authentication_token).toBe(registerResponse.body.token.accessToken);

    const meResponse = await supertest(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${registerResponse.body.authentication_token}`);

    expect(meResponse.status).toBe(200);
    expect(meResponse.body).toHaveProperty('user');
    expect(meResponse.body.user.id).toBe(100);
    expect(meResponse.body.user.email).toBe('testname@ufm.edu');
    expect(meResponse.body.user.passwordHash).toBeUndefined();
  });

  it('returns auth error when token is missing', async () => {
    const response = await supertest(app).get('/api/auth/me');

    expect(response.status).toBe(401);
    expect(response.body.error).toBe('unauthorized');
    expect(response.body.message).toBe('Token required');
  });
});
