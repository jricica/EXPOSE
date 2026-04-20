import { Request, Response } from 'express';
import * as Sentry from '@sentry/node';
import { messageService } from '../services/message.service';
import { getUserId } from '../utils/auth';

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
      const msgs = await messageService.listMessages(String(conversationId));
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
