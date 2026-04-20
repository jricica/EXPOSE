import supertest from 'supertest';
import app from '../src/server';
import { messageService } from '../src/services/message.service';

jest.mock('../src/middlewares/auth.middleware', () => ({
  authMiddleware: (req: any, _res: any, next: any) => {
    const authHeader = String(req.headers.authorization ?? 'Bearer 1');
    const token = authHeader.replace(/^Bearer\s+/i, '').trim();
    const userId = Number(token || 1);

    req.context = {
      userId: Number.isFinite(userId) && userId > 0 ? userId : 1,
      email: 'test@example.com',
      username: 'tester',
      role: 'USER',
    };

    return next();
  },
  optionalAuthMiddleware: (req: any, _res: any, next: any) => {
    const authHeader = String(req.headers.authorization ?? 'Bearer 1');
    const token = authHeader.replace(/^Bearer\s+/i, '').trim();
    const userId = Number(token || 1);

    req.context = {
      userId: Number.isFinite(userId) && userId > 0 ? userId : 1,
      email: 'test@example.com',
      username: 'tester',
      role: 'USER',
    };

    return next();
  },
}));

jest.mock('../src/services/message.service');

describe('Message API', () => {
  const mockedMessageService = messageService as jest.Mocked<typeof messageService>;
  const conversationPath = encodeURIComponent('1#2');

  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('creates a direct conversation', async () => {
    mockedMessageService.getOrCreateDirectConversation.mockResolvedValueOnce({
      conversationId: '1#2',
      type: 'direct',
      participantIds: [1, 2],
      participants: [
        { userId: 1, joinedAt: new Date('2026-04-19T18:00:00.000Z') },
        { userId: 2, joinedAt: new Date('2026-04-19T18:00:00.000Z') },
      ],
      createdAt: new Date('2026-04-19T18:00:00.000Z'),
      updatedAt: new Date('2026-04-19T18:00:00.000Z'),
    });

    const response = await supertest(app)
      .post('/api/conversations/direct')
      .set('Authorization', 'Bearer 1')
      .send({ participantUserId: 2 });

    expect(response.status).toBe(201);
    expect(response.body.conversationId).toBe('1#2');
    expect(mockedMessageService.getOrCreateDirectConversation).toHaveBeenCalledWith(1, 2);
  });

  it('sends a message to a conversation', async () => {
    mockedMessageService.sendMessageToConversation.mockResolvedValueOnce({
      conversationId: '1#2',
      messageId: '1713559200000#abc',
      senderId: 1,
      receiverId: 2,
      content: 'Hola',
      createdAt: new Date('2026-04-19T18:05:00.000Z'),
      readAt: null,
    });

    const response = await supertest(app)
      .post(`/api/conversations/${conversationPath}/messages`)
      .set('Authorization', 'Bearer 1')
      .send({ content: 'Hola' });

    expect(response.status).toBe(201);
    expect(response.body.messageId).toBe('1713559200000#abc');
    expect(mockedMessageService.sendMessageToConversation).toHaveBeenCalledWith(1, '1#2', 'Hola');
  });

  it('lists paginated conversation history', async () => {
    mockedMessageService.listConversationMessages.mockResolvedValueOnce({
      messages: [
        {
          conversationId: '1#2',
          messageId: '1713559200000#abc',
          senderId: 1,
          receiverId: 2,
          content: 'Hola',
          createdAt: new Date('2026-04-19T18:05:00.000Z'),
          readAt: null,
        },
      ],
      pagination: {
        limit: 20,
        nextCursorMessageId: null,
      },
    });

    const response = await supertest(app)
      .get(`/api/conversations/${conversationPath}/messages?limit=20`)
      .set('Authorization', 'Bearer 1');

    expect(response.status).toBe(200);
    expect(response.body.messages).toHaveLength(1);
    expect(response.body.pagination.limit).toBe(20);
    expect(mockedMessageService.listConversationMessages).toHaveBeenCalledWith(1, '1#2', {
      limit: 20,
      cursorMessageId: undefined,
    });
  });

  it('rejects non participants with 403', async () => {
    mockedMessageService.listConversationMessages.mockRejectedValueOnce(
      new Error('No autorizado para ver esta conversación'),
    );

    const response = await supertest(app)
      .get(`/api/conversations/${conversationPath}/messages`)
      .set('Authorization', 'Bearer 3');

    expect(response.status).toBe(403);
    expect(response.body.message).toMatch(/No autorizado/);
  });

  it('returns 404 when the conversation is missing', async () => {
    mockedMessageService.sendMessageToConversation.mockRejectedValueOnce(
      new Error('Conversación no encontrada'),
    );

    const response = await supertest(app)
      .post(`/api/conversations/${encodeURIComponent('9#10')}/messages`)
      .set('Authorization', 'Bearer 9')
      .send({ content: 'Hola' });

    expect(response.status).toBe(404);
    expect(response.body.message).toMatch(/Conversación no encontrada/);
  });
});
