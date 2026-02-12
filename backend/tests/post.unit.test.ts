import { PostService } from '../src/services/post.service';
import { PostRepository } from '../src/repositories/post.repository';
import { Post } from '../src/models/post.model';

describe('PostService', () => {
    let postService: PostService;
    let mockRepository: jest.Mocked<PostRepository>;

    beforeEach(() => {
        mockRepository = {
            create: jest.fn(),
            findById: jest.fn(),
            findMany: jest.fn(),
            updateExpiresAt: jest.fn(),
            toggleLike: jest.fn(),
        } as any;
        postService = new PostService(mockRepository);
    });

    it('should create a new post', async () => {
        const input = {
            userId: 1,
            content: 'Hello world',
        };

        const mockPost: Post = {
            id: 1,
            userId: 1,
            content: 'Hello world',
            createdAt: new Date(),
            expiresAt: new Date(),
            likes: 0,
        };

        mockRepository.create.mockResolvedValue(1);
        mockRepository.findById.mockResolvedValue(mockPost);

        const result = await postService.createPost(input);

        expect(mockRepository.create).toHaveBeenCalled();
        expect(result).toEqual(mockPost);
    });
});
