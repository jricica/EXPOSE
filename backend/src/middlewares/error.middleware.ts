import { Request, Response, NextFunction } from 'express';
import { logger } from '../config/logger';

export default function errorHandler(
  err: any,
  req: Request,
  res: Response,
  _next: NextFunction
) {
  const message = err instanceof Error ? err.message : 'Unexpected error';
  const status =
    err?.statusCode ??
    err?.status ??
    (message === 'Invalid credentials' ? 401 : 500);


  if (status >= 500) {
    logger.error('Unhandled server error', {
      message,
      stack: err?.stack,
      method: req.method,
      url: req.originalUrl,
      statusCode: status,
      ip: req.ip,
    });
  } else {
    logger.warn('Client error', {
      message,
      method: req.method,
      url: req.originalUrl,
      statusCode: status,
      ip: req.ip,
    });
  }

  res.status(status).json({
    success: false,
    message,
    data: null,
  });
}