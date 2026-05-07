import { NextFunction, Request, Response } from 'express';
import jwt, {
  JwtPayload,
  JsonWebTokenError,
  TokenExpiredError,
  NotBeforeError,
} from 'jsonwebtoken';
import * as Sentry from '@sentry/node';
import crypto from 'crypto';
import {
  JWT_ALLOWED_ALGORITHMS,
  JWT_AUDIENCE,
  JWT_CLOCK_TOLERANCE_SECONDS,
  JWT_ISSUER,
  JWT_SECRET,
} from '../config/env';
import { UserRepository } from '../repositories/user.repository';
import { UserContext, UnauthorizedError, AuthRequest, UserJwtPayload } from '../types/auth-context';
import { UserRole } from '../types/roles';
import { logger } from '../config/logger';

const jwtVerifyOptions: jwt.VerifyOptions = {
  algorithms: [...JWT_ALLOWED_ALGORITHMS],
  clockTolerance: JWT_CLOCK_TOLERANCE_SECONDS,
};

if (JWT_ISSUER) jwtVerifyOptions.issuer = JWT_ISSUER;
if (JWT_AUDIENCE) jwtVerifyOptions.audience = JWT_AUDIENCE;

const isClaimValidationError = (error: JsonWebTokenError): boolean => {
  const message = error.message.toLowerCase();
  return (
    message.includes('audience') ||
    message.includes('issuer') ||
    message.includes('subject') ||
    message.includes('jwt id') ||
    message.includes('issued at')
  );
};

const parseUserIdFromPayload = (decoded: UserJwtPayload): number => {
  if (!decoded.sub || !/^\d+$/.test(decoded.sub)) {
    throw new UnauthorizedError('Invalid token payload');
  }
  if (typeof decoded.email !== 'string' || decoded.email.trim() === '') {
    throw new UnauthorizedError('Invalid token payload');
  }
  const userId = parseInt(decoded.sub, 10);
  if (!Number.isInteger(userId) || userId <= 0) {
    throw new UnauthorizedError('Invalid token payload');
  }
  const nowInSeconds = Math.floor(Date.now() / 1000);
  if (typeof decoded.iat === 'number' && decoded.iat > nowInSeconds + JWT_CLOCK_TOLERANCE_SECONDS) {
    throw new UnauthorizedError('Invalid token payload');
  }
  return userId;
};

const handleAuthError = (res: Response, error: any, req: Request) => {
  if (error instanceof UnauthorizedError) {
    // Log intentos de acceso no autorizado
    logger.warn('Unauthorized access attempt', {
      message: error.message,
      url: req.originalUrl,
      method: req.method,
      ip: req.ip,
    });
    return res.status(401).json({ error: 'unauthorized', message: error.message });
  }

  if (error instanceof TokenExpiredError) {
    logger.warn('Expired token used', {
      url: req.originalUrl,
      ip: req.ip,
    });
    return res.status(401).json({ error: 'token_expired', message: 'Token expired' });
  }

  if (error instanceof NotBeforeError) {
    return res.status(401).json({ error: 'token_not_active', message: 'Token not active yet' });
  }

  if (error instanceof JsonWebTokenError) {
    if (isClaimValidationError(error)) {
      logger.warn('Invalid token claims', { url: req.originalUrl, ip: req.ip });
      return res.status(401).json({ error: 'invalid_token_claims', message: 'Invalid token claims' });
    }
    logger.warn('Invalid token', { url: req.originalUrl, ip: req.ip });
    return res.status(401).json({ error: 'invalid_token', message: 'Invalid token' });
  }

  
  logger.error('Unexpected auth error', {
    error: error?.message,
    stack: error?.stack,
    url: req.originalUrl,
    ip: req.ip,
  });
  Sentry.captureException(error);
  return res.status(500).json({ message: 'Internal server error' });
};

export const authMiddleware = async (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || typeof authHeader !== 'string') {
    logger.warn('Request missing auth token', { url: req.originalUrl, ip: req.ip });
    return res.status(401).json({ error: 'unauthorized', message: 'Token required' });
  }

  const [scheme, token] = authHeader.trim().split(/\s+/);

  if (scheme?.toLowerCase() !== 'bearer' || !token) {
    logger.warn('Malformed authorization header', { url: req.originalUrl, ip: req.ip });
    return res.status(401).json({ error: 'unauthorized', message: 'Invalid authorization header' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET, jwtVerifyOptions) as UserJwtPayload;
    const userId = parseUserIdFromPayload(decoded);
    const user = await UserRepository.findById(userId);

    if (!user) {
      throw new UnauthorizedError('Usuario no encontrado o inactivo');
    }


    logger.debug('Auth successful', { userId: user.id, url: req.originalUrl });

    const context: UserContext = {
      userId: user.id,
      email: user.email,
      username: user.username,
      role: normalizeRole(decoded.role),
    };

    const extendedReq = req as AuthRequest;
    extendedReq.context = context;
    extendedReq.user = decoded;

    return next();
  } catch (err) {
    if (
      !(
        err instanceof UnauthorizedError ||
        err instanceof TokenExpiredError ||
        err instanceof JsonWebTokenError
      )
    ) {
      const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
      Sentry.captureException(err, {
        extra: { tokenHash, path: req.originalUrl, method: req.method },
      });
    }
    return handleAuthError(res, err, req);
  }
};

export const optionalAuthMiddleware = async (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || typeof authHeader !== 'string') return next();

  const [scheme, token] = authHeader.trim().split(/\s+/);
  if (scheme?.toLowerCase() !== 'bearer' || !token) return next();

  try {
    const decoded = jwt.verify(token, JWT_SECRET, jwtVerifyOptions) as UserJwtPayload;
    const userId = parseUserIdFromPayload(decoded);
    const user = await UserRepository.findById(userId);

    if (user) {
      const context: UserContext = {
        userId: user.id,
        email: user.email,
        username: user.username,
        role: normalizeRole(decoded.role),
      };
      const extendedReq = req as AuthRequest;
      extendedReq.context = context;
      extendedReq.user = decoded;
    }
  } catch (err) {
    
    logger.debug('Optional auth failed, continuing as guest', {
      url: req.originalUrl,
      reason: err instanceof Error ? err.message : 'unknown',
    });
  }

  return next();
};

const normalizeRole = (role: unknown): UserRole => {
  const parsed = Number(role);
  if (parsed === 0 || parsed === 1) return parsed;
  throw new UnauthorizedError('Invalid role in token');
};