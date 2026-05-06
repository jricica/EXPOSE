import { Request, Response } from 'express';
import * as Sentry from '@sentry/node';
import { authService } from '../services/auth.service';
import { AuthRequest } from '../types/auth-context';

// Lightweight email sender stub. In production replace with SES/SMTP implementation.
import { sendPasswordResetEmail } from '../services/email.service';

export const requestPasswordReset = async (req: Request, res: Response) => {
  try {
    const { email } = req.body;
    if (!email || typeof email !== 'string') {
      return res.status(400).json({ message: 'Se requiere email' });
    }

    const token = await authService.generatePasswordResetToken(email);

    if (token) {
      try {
        const frontend = process.env.FRONTEND_URL || 'http://localhost:3000';
        const link = `${frontend.replace(/\/$/, '')}/auth/reset?token=${encodeURIComponent(token)}`;
        // fire-and-forget
        await sendPasswordResetEmail(email, link);
      } catch (e) {
        // ignore email send errors
      }
    }

    return res.json({ message: 'Si la cuenta existe, se ha enviado un enlace para restablecer la contraseña' });
  } catch (err) {
    Sentry.captureException(err);
    return res.status(500).json({ message: 'Error procesando la solicitud' });
  }
};

export const resetPassword = async (req: Request, res: Response) => {
  try {
    const { token, password } = req.body;
    if (!token || typeof token !== 'string' || !password || typeof password !== 'string') {
      return res.status(400).json({ message: 'Token y nueva contraseña son requeridos' });
    }

    await authService.resetPasswordWithToken(token, password);
    return res.json({ message: 'Contraseña actualizada' });
  } catch (err) {
    Sentry.captureException(err);
    return res.status(400).json({ message: (err instanceof Error) ? err.message : 'Token inválido o expirado' });
  }
};

export const changePassword = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.context) return res.status(401).json({ message: 'No autorizado' });
    const userId = Number(req.context.userId);
    const { oldPassword, newPassword } = req.body;
    if (!oldPassword || !newPassword) return res.status(400).json({ message: 'Old and new passwords are required' });

    await authService.changePassword(userId, oldPassword, newPassword);
    return res.json({ message: 'Contraseña cambiada correctamente' });
  } catch (err) {
    Sentry.captureException(err);
    return res.status(400).json({ message: (err instanceof Error) ? err.message : 'Error al cambiar contraseña' });
  }
};
