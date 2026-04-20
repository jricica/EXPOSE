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

const jwtVerifyOptions: jwt.VerifyOptions = {
  algorithms: [...JWT_ALLOWED_ALGORITHMS],
  clockTolerance: JWT_CLOCK_TOLERANCE_SECONDS,
};

if (JWT_ISSUER) {
  jwtVerifyOptions.issuer = JWT_ISSUER;
}

if (JWT_AUDIENCE) {
  jwtVerifyOptions.audience = JWT_AUDIENCE;
}

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

const handleAuthError = (res: Response, error: any) => {
  if (error instanceof UnauthorizedError) {
    return res.status(401).json({ error: 'unauthorized', message: error.message });
  }

  if (error instanceof TokenExpiredError) {
    return res.status(401).json({ error: 'token_expired', message: 'Token expired' });
  }

  if (error instanceof NotBeforeError) {
    return res.status(401).json({ error: 'token_not_active', message: 'Token not active yet' });
  }

  if (error instanceof JsonWebTokenError) {
    if (isClaimValidationError(error)) {
      return res.status(401).json({ error: 'invalid_token_claims', message: 'Invalid token claims' });
    }

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
    const decoded = jwt.verify(token, JWT_SECRET, jwtVerifyOptions) as UserJwtPayload;
    const userId = parseUserIdFromPayload(decoded);
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
    const decoded = jwt.verify(token, JWT_SECRET, jwtVerifyOptions) as UserJwtPayload;
    const userId = parseUserIdFromPayload(decoded);
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
  } catch (err) {
    // En el modo opcional, simplemente ignoramos los errores de token
    // (token expirado, inválido, etc) y dejamos que el usuario proceda como invitado
  }

  return next();
};
