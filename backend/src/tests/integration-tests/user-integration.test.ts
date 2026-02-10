import { likeRepository } from '../../repositories/post.repository';

describe('likeRepository integration', () => {
  
  let createdId: string | null = null;

  afterEach(async () => {
    if (createdId) {
      await likeRepository.delete(createdId);
      createdId = null;
    }
  });

  it('creates and finds a like by postId and userId', async () => {
    const postId = 'post-1';
    const userId = 'user-1';
    const created = await likeRepository.create(postId, userId);

    createdId = created.id; 

    const found = await likeRepository.find(postId, userId);

    expect(found).not.toBeNull();
    expect(found).toEqual(created);
  });
});