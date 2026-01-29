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

export interface UserJwtPayload extends JwtPayload {
  sub: string;
  email: string;
  role?: string;
}

export interface AuthenticatedRequest extends Request {
  user?: UserJwtPayload;
}

const unauthorized = (
  res: Response,
  message: string,
  code = 'unauthorized',
) =>
  res.status(401).json({ error: code, message });

export const authMiddleware = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || typeof authHeader !== 'string') {
    return unauthorized(res, 'Token required');
  }

  const [scheme, token] = authHeader.trim().split(/\s+/);

  if (scheme?.toLowerCase() !== 'bearer' || !token) {
    return unauthorized(res, 'Invalid authorization header');
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET, {
      algorithms: ['HS256'],
      clockTolerance: 5,
    });

    if (typeof decoded === 'string' || !decoded.sub) {
      return unauthorized(res, 'Invalid token payload', 'invalid_payload');
    }

    req.user = decoded as UserJwtPayload;
    return next();
  } catch (err) {
    if (err instanceof TokenExpiredError) {
      return unauthorized(res, 'Token expired', 'token_expired');
    }

    if (err instanceof NotBeforeError) {
      return unauthorized(res, 'Token not active yet', 'token_not_active');
    }

    if (err instanceof JsonWebTokenError) {
      return unauthorized(res, 'Invalid token', 'invalid_token');
    }

    const tokenHash = crypto
      .createHash('sha256')
      .update(token)
      .digest('hex');

    Sentry.captureException(err, {
      level: 'error',
      extra: {
        tokenHash,
        path: req.originalUrl,
        method: req.method,
      },
    });

    return res.status(500).json({ message: 'Internal server error' });
  }
};
