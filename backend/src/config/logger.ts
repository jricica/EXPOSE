import winston from 'winston';
import * as Sentry from '@sentry/node';
import { AsyncLocalStorage } from 'async_hooks';

// Async context storage for request tracking
const asyncLocalStorage = new AsyncLocalStorage<{
  requestId: string;
  userId: string;
}>();

// Custom format for structured logging
const structuredFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json(),
  winston.format.printf((info: any) => {
    const store = asyncLocalStorage.getStore();
    const logEntry = {
      timestamp: info.timestamp,
      level: info.level,
      message: info.message,
      ...info,
      // Add request context if available
      requestId: store?.requestId || 'unknown',
      userId: store?.userId || 'anonymous',
      service: 'expose-backend',
      environment: process.env.NODE_ENV || 'development'
    };
    return JSON.stringify(logEntry);
  })
);

// Console format for development
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.printf((info: any) => {
    const metaStr = Object.keys(info).length > 3 ? `\n${JSON.stringify(info, null, 2)}` : '';
    return `${info.timestamp} ${info.level}: ${info.message}${metaStr}`;
  })
);

// Create logger instance
export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: structuredFormat,
  defaultMeta: {
    service: 'expose-backend',
    environment: process.env.NODE_ENV || 'development'
  },
  transports: [
    // Error log file
    new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error',
      format: structuredFormat
    }),
    // Combined log file
    new winston.transports.File({
      filename: 'logs/combined.log',
      format: structuredFormat
    })
  ]
});

// Add console transport for development
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: consoleFormat
  }));
}

// Override console methods to use winston
console.log = (...args) => logger.info(args.join(' '));
console.error = (...args) => logger.error(args.join(' '));
console.warn = (...args) => logger.warn(args.join(' '));
console.info = (...args) => logger.info(args.join(' '));

// Error handler that integrates with Sentry
export const logError = (error: Error, context?: Record<string, any>) => {
  logger.error('Application error', {
    error: error.message,
    stack: error.stack,
    ...context
  });

  // Send to Sentry with additional context
  Sentry.captureException(error, {
    tags: {
      service: 'expose-backend',
      environment: process.env.NODE_ENV || 'development'
    },
    extra: context
  });
};

// Request logging middleware
export const requestLogger = (req: any, res: any, next: any) => {
  const start = Date.now();
  const requestId = req.headers['x-request-id'] || req.id || `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  // Set request context for async operations
  const store = {
    requestId,
    userId: req.context?.userId || 'anonymous'
  };

  asyncLocalStorage.run(store, () => {
    logger.info('Request started', {
      method: req.method,
      url: req.url,
      userAgent: req.get('User-Agent'),
      ip: req.ip,
      requestId
    });

    // Log response
    res.on('finish', () => {
      const duration = Date.now() - start;
      logger.info('Request completed', {
        method: req.method,
        url: req.url,
        statusCode: res.statusCode,
        duration: `${duration}ms`,
        requestId
      });
    });

    next();
  });
};

export default logger;