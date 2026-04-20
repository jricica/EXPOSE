import { PostService } from '../src/services/post.service';
import { PostRepository } from '../src/repositories/post.repository';
import { Post } from '../src/models/post.model';
import { FeedTimelineRepository } from '../src/repositories/feed-timeline.repository';
import { RelationshipRepository } from '../src/repositories/relationship.repository';

describe('PostService', () => {
    let postService: PostService;
    let mockRepository: jest.Mocked<PostRepository>;
    let mockTimelineRepository: jest.Mocked<FeedTimelineRepository>;
    let mockRelationshipRepository: jest.Mocked<RelationshipRepository>;

    beforeEach(() => {
        mockRepository = {
            create: jest.fn(),
            findById: jest.fn(),
            findMany: jest.fn(),
            updateExpiresAt: jest.fn(),
            toggleLike: jest.fn(),
            delete: jest.fn(),
            markFanOutReady: jest.fn(),
        } as any;
        mockTimelineRepository = {
            fanOutPostCreated: jest.fn(),
        } as any;
        mockRelationshipRepository = {
            listFollowers: jest.fn(),
        } as any;

        mockRelationshipRepository.listFollowers.mockResolvedValue([]);
        postService = new PostService(mockRepository, mockTimelineRepository, mockRelationshipRepository);
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

    it('should delete post when actor is owner', async () => {
        const existingPost: Post = {
            id: 123,
            userId: 10,
            content: 'Owned post',
            createdAt: new Date(),
            expiresAt: new Date(Date.now() + 60_000),
            likes: 0,
        };

        mockRepository.findById.mockResolvedValue(existingPost);

        await postService.deletePost(123, 10);

        expect(mockRepository.findById).toHaveBeenCalledWith(123);
        expect(mockRepository.delete).toHaveBeenCalledWith(123);
    });

    it('should reject delete when actor is not owner', async () => {
        const existingPost: Post = {
            id: 123,
            userId: 20,
            content: 'Other user post',
            createdAt: new Date(),
            expiresAt: new Date(Date.now() + 60_000),
            likes: 0,
        };

        mockRepository.findById.mockResolvedValue(existingPost);

        await expect(postService.deletePost(123, 10)).rejects.toThrow('No autorizado para eliminar este post');
        expect(mockRepository.delete).not.toHaveBeenCalled();
    });
});
