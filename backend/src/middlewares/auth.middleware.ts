import { NextFunction, Request, Response } from 'express';
import jwt, {
  JwtPayload,
  JsonWebTokenError,
  TokenExpiredError,
  NotBeforeError,
} from 'jsonwebtoken';
import * as Sentry from '@sentry/node';
import crypto from 'crypto';
import { JWT_SECRET } from '../config/env';
import { UserRepository } from '../repositories/user.repository';
import { UserContext, UnauthorizedError, AuthRequest, UserJwtPayload } from '../types/auth-context';

const handleAuthError = (res: Response, error: any) => {
  if (error instanceof UnauthorizedError) {
    return res.status(401).json({ error: 'unauthorized', message: error.message });
  }

  if (error instanceof TokenExpiredError) {
    return res.status(401).json({ error: 'token_expired', message: 'Token expired' });
  }

  if (error instanceof JsonWebTokenError) {
    return res.status(401).json({ error: 'invalid_token', message: 'Invalid token' });
  }

  Sentry.captureException(error);
  return res.status(500).json({ message: 'Internal server error' });
};

export const authMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || typeof authHeader !== 'string') {
    return res.status(401).json({ error: 'unauthorized', message: 'Token required' });
  }

  const [scheme, token] = authHeader.trim().split(/\s+/);

  if (scheme?.toLowerCase() !== 'bearer' || !token) {
    return res.status(401).json({ error: 'unauthorized', message: 'Invalid authorization header' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET, {
      algorithms: ['HS256'],
      clockTolerance: 5,
    }) as UserJwtPayload;

    if (!decoded.sub) {
      throw new UnauthorizedError('Invalid token payload');
    }

    const userId = parseInt(decoded.sub, 10);
    const user = await UserRepository.findById(userId);

    if (!user) {
      throw new UnauthorizedError('Usuario no encontrado o inactivo');
    }

    const context: UserContext = {
      userId: user.id,
      email: user.email,
      username: user.username,
      role: decoded.role,
    };

    // Casting a AuthRequest para evitar errores de compilación
    const extendedReq = req as AuthRequest;
    extendedReq.context = context;
    extendedReq.user = decoded;

    return next();
  } catch (err) {
    if (!(err instanceof UnauthorizedError || err instanceof TokenExpiredError || err instanceof JsonWebTokenError)) {
      const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
      Sentry.captureException(err, {
        extra: { tokenHash, path: req.originalUrl, method: req.method },
      });
    }

    return handleAuthError(res, err);
  }
};
export const optionalAuthMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || typeof authHeader !== 'string') {
    return next();
  }

  const [scheme, token] = authHeader.trim().split(/\s+/);

  if (scheme?.toLowerCase() !== 'bearer' || !token) {
    return next();
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET, {
      algorithms: ['HS256'],
      clockTolerance: 5,
    }) as UserJwtPayload;

    if (decoded.sub) {
      const userId = parseInt(decoded.sub, 10);
      const user = await UserRepository.findById(userId);

      if (user) {
        const context: UserContext = {
          userId: user.id,
          email: user.email,
          username: user.username,
          role: decoded.role,
        };

        const extendedReq = req as AuthRequest;
        extendedReq.context = context;
        extendedReq.user = decoded;
      }
    }
  } catch (err) {
    // En el modo opcional, simplemente ignoramos los errores de token
    // (token expirado, inválido, etc) y dejamos que el usuario proceda como invitado
  }

  return next();
};
