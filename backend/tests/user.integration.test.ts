import supertest from 'supertest';
import app from '../src/server';
import { UserRepository } from '../src/repositories/user.repository';

jest.mock('../src/repositories/user.repository');

describe('UserRegister', () => {
    it('should return a successful register object', async () => {
        (UserRepository.findByEmail as jest.Mock).mockResolvedValue(null);
        (UserRepository.create as jest.Mock).mockResolvedValue(100);
        (UserRepository.findById as jest.Mock).mockResolvedValue({
            id: 100,
            username: "testname",
            email: "testname@gmail.com",
            passwordHash: "hashed",
            role: 1,
            friends: [],
            createdAt: new Date()
        });

        const response = await supertest(app).post('/api/auth/register').send({
            "email": "testname@gmail.com",
            "password": "passwordlargo",
            "username": "testname"
        })

        expect(response.status).toBe(201);
        expect(response.body).toBeDefined();
        expect(response.body).toHaveProperty("email");
        expect(response.body.email).toBe(
            "testname@gmail.com"
        );
    });
});

describe('PasswordValidation', () => {
    it('should return an error for invalid password', async () => {

        const response = await supertest(app).post('/api/auth/register').send({
            "email": "testname@gmail.com",
            "password": "test", // < 8 chars
            "username": "testname"
        })

        expect(response.status).toBe(400);
        expect(response.body).toBeDefined();
        expect(response.body.Code).toBe(1000);
        expect(response.body.Message).toBe("User entered an invalid password.");
    });
});
