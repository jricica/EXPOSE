import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth.middleware';
import { requireAdmin, requireRole } from '../middlewares/requireRole.middleware';

/**
 * Ejemplo de cómo usar el middleware de roles/permisos centralizado
 * Este archivo es de REFERENCIA - no está en uso actualmente
 */

const router = Router();

// ✅ Acceso solo para admins (rol 0)
// router.get('/admin/users', authMiddleware, requireAdmin, getAllUsers);
// router.delete('/admin/users/:id', authMiddleware, requireAdmin, deleteUser);

// ✅ Acceso para múltiples roles (ej: admin O moderador)
// router.post('/admin/reports', authMiddleware, requireRole(0, 1), generateReport);

// ✅ Acceso solo para usuarios regulares (rol 1)
// router.post('/profile/update', authMiddleware, requireRole(1), updateProfile);

/**
 * El middleware requireRole() valida que:
 * 1. El usuario está autenticado (tiene req.context)
 * 2. Su rol (de req.context.role) está en la lista de roles permitidos
 * 3. Si no hay rol, se asume rol 1 (usuario regular)
 *
 * Respuestas:
 * - 401: Usuario no autenticado
 * - 403: Usuario autenticado pero sin permisos suficientes
 * - 200/2xx: Acceso concedido
 */

export default router;
