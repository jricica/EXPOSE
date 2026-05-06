import { NextFunction, Response } from 'express';
import { AuthRequest } from '../types/auth-context';
import { messageRepository } from '../repositories/message.repository';
import { getUserId } from '../utils/auth';
import * as Sentry from '@sentry/node';

/**
 * Middleware que valida que el usuario es participante de la conversación solicitada.
 * Previene que usuarios sin autorización accedan a conversaciones ajenas.
 *
 * Uso: router.get('/conversations/:conversationId/messages', authMiddleware, validateConversationOwnership, handler)
 */
export const validateConversationOwnership = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const conversationId = req.params.conversationId;
    const userId = getUserId(req);

    if (!conversationId || typeof conversationId !== 'string') {
      return res.status(400).json({ message: 'conversationId inválido' });
    }

    // Obtener la conversación de la base de datos
    const conversation = await messageRepository.getConversation(conversationId);

    // Si no existe la conversación, retornar 404
    if (!conversation) {
      return res.status(404).json({ message: 'Conversación no encontrada' });
    }

    // Validar que el usuario es participante
    if (!conversation.participantIds.includes(userId)) {
      Sentry.captureMessage(`Unauthorized conversation access attempt`, {
        level: 'warning',
        extra: {
          userId,
          conversationId,
          participantIds: conversation.participantIds,
        },
      });
      return res.status(403).json({ message: 'No autorizado para acceder a esta conversación' });
    }

    // Agregar la conversación al request para evitar otra consulta en el controlador
    (req as any).conversation = conversation;

    next();
  } catch (err) {
    Sentry.captureException(err);
    res.status(500).json({ message: 'Error al validar acceso a conversación' });
  }
};
