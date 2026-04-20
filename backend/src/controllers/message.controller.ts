import { Request, Response } from 'express';
import * as Sentry from '@sentry/node';
import { messageService } from '../services/message.service';
import { getUserId } from '../utils/auth';

export const createDirectConversation = async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const participantUserId = Number(req.body?.participantUserId);

    if (!Number.isInteger(participantUserId) || participantUserId <= 0) {
      return res.status(400).json({ message: 'participantUserId inválido' });
    }

    const conversation = await messageService.getOrCreateDirectConversation(userId, participantUserId);
    res.status(201).json(conversation);
  } catch (err) {
    Sentry.captureException(err);
    res.status(400).json({ message: err instanceof Error ? err.message : 'Error al crear conversación.' });
  }
};

export const listConversations = async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const conversations = await messageService.listConversations(userId);
    res.json(conversations);
  } catch (err) {
    Sentry.captureException(err);
    res.status(500).json({ message: err instanceof Error ? err.message : 'Error al listar conversaciones.' });
  }
};

export const sendConversationMessage = async (req: Request, res: Response) => {
  try {
    const senderId = getUserId(req);
    const conversationId = String(req.params.conversationId);
    const { content } = req.body ?? {};

    if (!content || typeof content !== 'string') {
      return res.status(400).json({ message: 'content es requerido y debe ser string' });
    }

    const message = await messageService.sendMessageToConversation(senderId, conversationId, content);
    res.status(201).json(message);
  } catch (err) {
    Sentry.captureException(err);
    if (err instanceof Error && /no autorizado/i.test(err.message)) {
      return res.status(403).json({ message: err.message });
    }

    if (err instanceof Error && /no encontrada/i.test(err.message)) {
      return res.status(404).json({ message: err.message });
    }

    res.status(400).json({ message: err instanceof Error ? err.message : 'Error al enviar mensaje.' });
  }
};

export const listConversationMessages = async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const conversationId = String(req.params.conversationId);
    const rawLimit = req.query.limit;
    const limit = rawLimit ? Number(rawLimit) : undefined;

    if (rawLimit !== undefined && (!Number.isInteger(limit) || Number(limit) <= 0)) {
      return res.status(400).json({ message: 'limit inválido' });
    }

    const result = await messageService.listConversationMessages(userId, conversationId, {
      limit,
      cursorMessageId: req.query.cursorMessageId ? String(req.query.cursorMessageId) : undefined,
    });

    res.json(result);
  } catch (err) {
    Sentry.captureException(err);
    if (err instanceof Error && /no autorizado/i.test(err.message)) {
      return res.status(403).json({ message: err.message });
    }

    if (err instanceof Error && /no encontrada/i.test(err.message)) {
      return res.status(404).json({ message: err.message });
    }

    res.status(500).json({ message: 'Error al obtener mensajes.' });
  }
};

export const markConversationRead = async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const conversationId = String(req.params.conversationId);
    const messageId = req.body?.messageId ? String(req.body.messageId) : undefined;

    await messageService.markConversationRead(userId, conversationId, messageId);
    res.status(204).send();
  } catch (err) {
    Sentry.captureException(err);
    if (err instanceof Error && /no autorizado/i.test(err.message)) {
      return res.status(403).json({ message: err.message });
    }

    if (err instanceof Error && /no encontrada/i.test(err.message)) {
      return res.status(404).json({ message: err.message });
    }

    res.status(400).json({ message: err instanceof Error ? err.message : 'Error al marcar lectura.' });
  }
};

export const sendMessage = async (req: Request, res: Response) => {
  try {
    const senderId = getUserId(req);
    const { receiverId, content, conversationId } = req.body;
    const message = await messageService.sendMessage(senderId, Number(receiverId), content, conversationId);
    res.status(201).json(message);
  } catch (err) {
    Sentry.captureException(err);
    res.status(400).json({ message: err instanceof Error ? err.message : 'Error al enviar mensaje.' });
  }
};

export const listMessages = async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const { conversationId, withUserId } = req.query;

    if (conversationId) {
      const msgs = await messageService.listConversationMessages(userId, String(conversationId), {
        limit: 100,
      });
      return res.json(msgs);
    }

    if (withUserId) {
      const msgs = await messageService.listWithUser(userId, Number(withUserId));
      return res.json(msgs);
    }

    return res.status(400).json({ message: 'conversationId o withUserId requerido' });
  } catch (err) {
    Sentry.captureException(err);
    res.status(500).json({ message: 'Error al obtener mensajes.' });
  }
};
