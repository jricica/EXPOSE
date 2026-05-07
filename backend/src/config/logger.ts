import winston from 'winston';
import * as Sentry from '@sentry/node';
import { AsyncLocalStorage } from 'async_hooks';
import DailyRotateFile from 'winston-daily-rotate-file';

const asyncLocalStorage = new AsyncLocalStorage<{
  requestId: string;
  userId: string;
}>();

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
      requestId: store?.requestId || 'unknown',
      userId: store?.userId || 'anonymous',
      service: 'expose-backend',
      environment: process.env.NODE_ENV || 'development'
    };
    return JSON.stringify(logEntry);
  })
);

const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.printf((info: any) => {
    const metaStr = Object.keys(info).length > 3 ? `\n${JSON.stringify(info, null, 2)}` : '';
    return `${info.timestamp} ${info.level}: ${info.message}${metaStr}`;
  })
);

const isProduction = process.env.NODE_ENV === 'production';

// ✅ Transportes de archivo — el CloudWatch Agent los lee desde estas rutas
const fileTransports = isProduction
  ? [
      new DailyRotateFile({
        filename: '/var/log/social-media/app-%DATE%.log',
        datePattern: 'YYYY-MM-DD',
        level: 'info',
        format: structuredFormat,
        maxFiles: '7d',
        zippedArchive: true,
      }),
      new DailyRotateFile({
        filename: '/var/log/social-media/error-%DATE%.log',
        datePattern: 'YYYY-MM-DD',
        level: 'error',
        format: structuredFormat,
        maxFiles: '14d',
        zippedArchive: true,
      }),
    ]
  : [
      // En desarrollo, escribe localmente
      new winston.transports.File({ filename: 'logs/error.log', level: 'error', format: structuredFormat }),
      new winston.transports.File({ filename: 'logs/combined.log', format: structuredFormat }),
    ];

export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: structuredFormat,
  defaultMeta: {
    service: 'expose-backend',
    environment: process.env.NODE_ENV || 'development'
  },
  transports: fileTransports as any
});

// Consola solo en desarrollo
if (!isProduction) {
  logger.add(new winston.transports.Console({ format: consoleFormat }));
}

// Override console methods
console.log = (...args) => logger.info(args.join(' '));
console.error = (...args) => logger.error(args.join(' '));
console.warn = (...args) => logger.warn(args.join(' '));
console.info = (...args) => logger.info(args.join(' '));

export const logError = (error: Error, context?: Record<string, any>) => {
  logger.error('Application error', {
    error: error.message,
    stack: error.stack,
    ...context
  });
  Sentry.captureException(error, {
    tags: { service: 'expose-backend', environment: process.env.NODE_ENV || 'development' },
    extra: context
  });
};

export const requestLogger = (req: any, res: any, next: any) => {
  const start = Date.now();
  const requestId =
    req.headers['x-request-id'] ||
    req.id ||
    `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

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