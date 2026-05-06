import { NextFunction, Response } from 'express';
import { AuthRequest } from '../types/auth-context';
import * as Sentry from '@sentry/node';

/**
 * Tipos de roles en el sistema.
 * 0 = Admin
 * 1 = Usuario regular
 */
export type UserRole = 0 | 1;

/**
 * Factory para crear un middleware que valida que el usuario tiene uno de los roles requeridos.
 *
 * Uso en rutas:
 * router.get('/admin/users', authMiddleware, requireRole(0), adminUserController)
 * router.post('/admin/reports', authMiddleware, requireRole(0), generateReportController)
 */
export const requireRole = (...allowedRoles: UserRole[]) => {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const userRole = req.context?.role;

      // Si no hay rol en el contexto, el usuario no está autenticado
      if (req.context === undefined) {
        return res.status(401).json({ message: 'No autorizado' });
      }

      // Validar que el rol del usuario está en la lista de roles permitidos
      // Por defecto, si no hay rol, consideramos que es un usuario regular (rol 1)
      const userRoleValue: UserRole = userRole ?? 1;

      if (!allowedRoles.includes(userRoleValue)) {
        Sentry.captureMessage(`Unauthorized role access attempt`, {
          level: 'warning',
          extra: {
            userId: req.context.userId,
            userRole: userRoleValue,
            allowedRoles,
            path: req.path,
            method: req.method,
          },
        });

        return res.status(403).json({
          message: 'No tienes permisos suficientes para acceder a este recurso',
          error: 'insufficient_permissions',
        });
      }

      next();
    } catch (err) {
      Sentry.captureException(err);
      res.status(500).json({ message: 'Error al validar permisos' });
    }
  };
};

/**
 * Alias para verificar que el usuario es admin (rol 0)
 */
export const requireAdmin = requireRole(0);
