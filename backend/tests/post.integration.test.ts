import supertest from 'supertest';
import app from '../src/server';
import { postRepository } from '../src/repositories/post.repository';

jest.mock('../src/repositories/post.repository');

describe('Post API', () => {
    it('should list all posts', async () => {
        const mockPosts = [
            {
                id: 1,
                userId: 1,
                content: 'Test post',
                createdAt: new Date().toISOString(),
                expiresAt: new Date().toISOString(),
                likes: 0
            }
        ];

        (postRepository.findMany as jest.Mock).mockResolvedValue(mockPosts);

        const response = await supertest(app).get('/api/posts');

        expect(response.status).toBe(200);
        expect(Array.isArray(response.body)).toBe(true);
        expect(response.body.length).toBe(1);
        expect(response.body[0].content).toBe('Test post');
        expect(response.body[0]).toHaveProperty('likes');
        expect(response.body[0]).toHaveProperty('createdAt');
        expect(response.body[0]).toHaveProperty('expiresAt');
    });
});
