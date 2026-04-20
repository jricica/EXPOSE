import { MessageService } from '../src/services/message.service';
import type { MessageRepository } from '../src/repositories/message.repository';

describe('MessageService', () => {
  const buildRepo = () => {
    const repo: jest.Mocked<MessageRepository> = {
      createConversation: jest.fn(),
      getConversation: jest.fn(),
      listConversationsByUser: jest.fn(),
      updateConversation: jest.fn(),
      save: jest.fn(),
      listPaginated: jest.fn(),
      markConversationRead: jest.fn(),
      list: jest.fn(),
      touchConversationAfterSend: jest.fn(),
      markMessageRead: jest.fn(),
    } as unknown as jest.Mocked<MessageRepository>;

    return repo;
  };

  it('creates or returns direct conversation', async () => {
    const repo = buildRepo();
    repo.getConversation.mockResolvedValueOnce(null).mockResolvedValueOnce({
      conversationId: '1#2',
      type: 'direct',
      participantIds: [1, 2],
      participants: [
        { userId: 1, joinedAt: new Date() },
        { userId: 2, joinedAt: new Date() },
      ],
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const service = new MessageService(repo);
    const conversation = await service.getOrCreateDirectConversation(2, 1);

    expect(conversation.conversationId).toBe('1#2');
    expect(repo.createConversation).toHaveBeenCalledTimes(1);
  });

  it('rejects listing messages for non participant', async () => {
    const repo = buildRepo();
    repo.getConversation.mockResolvedValue({
      conversationId: '1#2',
      type: 'direct',
      participantIds: [1, 2],
      participants: [
        { userId: 1, joinedAt: new Date() },
        { userId: 2, joinedAt: new Date() },
      ],
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const service = new MessageService(repo);

    await expect(service.listConversationMessages(3, '1#2', { limit: 20 })).rejects.toThrow(
      'No autorizado para ver esta conversación',
    );
  });

  it('paginates conversation messages with bounded limit', async () => {
    const repo = buildRepo();
    repo.getConversation.mockResolvedValue({
      conversationId: '1#2',
      type: 'direct',
      participantIds: [1, 2],
      participants: [
        { userId: 1, joinedAt: new Date() },
        { userId: 2, joinedAt: new Date() },
      ],
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    repo.listPaginated.mockResolvedValue({
      messages: [],
      pagination: {
        limit: 100,
        nextCursorMessageId: null,
      },
    });

    const service = new MessageService(repo);
    const result = await service.listConversationMessages(1, '1#2', { limit: 500 });

    expect(result.pagination.limit).toBe(100);
    expect(repo.listPaginated).toHaveBeenCalledWith('1#2', {
      limit: 100,
      cursorMessageId: undefined,
    });
  });

  it('sends message only if sender is participant', async () => {
    const repo = buildRepo();
    repo.getConversation.mockResolvedValue({
      conversationId: '1#2',
      type: 'direct',
      participantIds: [1, 2],
      participants: [
        { userId: 1, joinedAt: new Date() },
        { userId: 2, joinedAt: new Date() },
      ],
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const service = new MessageService(repo);
    await service.sendMessageToConversation(1, '1#2', 'hola');

    expect(repo.save).toHaveBeenCalledTimes(1);
    expect(repo.touchConversationAfterSend).toHaveBeenCalledTimes(1);
  });
});
