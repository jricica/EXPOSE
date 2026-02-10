import { likeRepository } from '../repositories/post.repository';

describe('likeRepository', () => {
  it('creates and finds a like by postId and userId', async () => {
    const postId = 'post-1';
    const userId = 'user-1';

    const created = await likeRepository.create(postId, userId);
    const found = await likeRepository.find(postId, userId);

    expect(found).toEqual(created);
  });
});