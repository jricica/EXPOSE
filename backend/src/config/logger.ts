import winston from 'winston';
import * as Sentry from '@sentry/node';
import { AsyncLocalStorage } from 'async_hooks';
import { CloudWatchLogsClient, CreateLogGroupCommand, CreateLogStreamCommand, DescribeLogStreamsCommand, PutLogEventsCommand } from '@aws-sdk/client-cloudwatch-logs';

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

// Create logger instance (files + optional CloudWatch transport)
const useCloudWatch = process.env.USE_CLOUDWATCH === 'true' || process.env.NODE_ENV === 'production';

const cloudWatchLogGroup = process.env.CLOUDWATCH_LOG_GROUP || '/expose/backend/production';
const cloudWatchLogStream = process.env.CLOUDWATCH_LOG_STREAM || process.env.HOSTNAME || 'api-server';

let cwClient: CloudWatchLogsClient | undefined;
if (useCloudWatch) {
  cwClient = new CloudWatchLogsClient({
    region: process.env.AWS_REGION || 'us-east-1',
    credentials: process.env.AWS_ACCESS_KEY_ID ? {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || ''
    } : undefined
  });
}

let cwSequenceToken: string | undefined;
const cwQueue: Array<{ message: string; timestamp: number }> = [];
let cwInited = false;

async function initCloudWatch() {
  if (!useCloudWatch || !cwClient) return;
  try {
    await cwClient.send(new CreateLogGroupCommand({ logGroupName: cloudWatchLogGroup }));
  } catch (err: any) {
    // ignore if exists
  }
  try {
    await cwClient.send(new CreateLogStreamCommand({ logGroupName: cloudWatchLogGroup, logStreamName: cloudWatchLogStream }));
  } catch (err: any) {
    // ignore if exists
  }
  try {
    const desc = await cwClient.send(new DescribeLogStreamsCommand({ logGroupName: cloudWatchLogGroup, logStreamNamePrefix: cloudWatchLogStream }));
    cwSequenceToken = desc.logStreams?.[0]?.uploadSequenceToken;
  } catch (err) {
    // ignore
  }
  cwInited = true;
}

async function flushCloudWatch() {
  if (!useCloudWatch || !cwClient || !cwInited || cwQueue.length === 0) return;
  const events = cwQueue.splice(0, cwQueue.length)
    .map(e => ({ message: e.message, timestamp: e.timestamp }))
    .sort((a, b) => a.timestamp - b.timestamp);
  try {
    const resp = await cwClient.send(new PutLogEventsCommand({
      logGroupName: cloudWatchLogGroup,
      logStreamName: cloudWatchLogStream,
      logEvents: events,
      sequenceToken: cwSequenceToken
    }));
    cwSequenceToken = resp.nextSequenceToken;
  } catch (err: any) {
    const name = err?.name;
    if (name === 'InvalidSequenceTokenException' || name === 'DataAlreadyAcceptedException') {
      try {
        const desc = await cwClient.send(new DescribeLogStreamsCommand({ logGroupName: cloudWatchLogGroup, logStreamNamePrefix: cloudWatchLogStream }));
        cwSequenceToken = desc.logStreams?.[0]?.uploadSequenceToken;
        const resp2 = await cwClient.send(new PutLogEventsCommand({
          logGroupName: cloudWatchLogGroup,
          logStreamName: cloudWatchLogStream,
          logEvents: events,
          sequenceToken: cwSequenceToken
        }));
        cwSequenceToken = resp2.nextSequenceToken;
      } catch (err2) {
        // drop
      }
    } else {
      // drop or log
    }
  }
}

if (useCloudWatch) {
  initCloudWatch().catch(() => {});
  setInterval(() => flushCloudWatch().catch(() => {}), 2000);
}

const cloudWatchTransport: any = {
  log: (info: any, callback?: () => void) => {
    try {
      const message = typeof info.message === 'string' ? info.message : JSON.stringify(info);
      cwQueue.push({ message, timestamp: Date.now() });
      if (cwQueue.length > 2000) {
        cwQueue.splice(0, cwQueue.length - 2000);
      }
    } catch (e) {}
    if (callback) setImmediate(callback);
  }
};

const transportsList: any[] = [
  new winston.transports.File({
    filename: 'logs/error.log',
    level: 'error',
    format: structuredFormat
  }),
  new winston.transports.File({
    filename: 'logs/combined.log',
    format: structuredFormat
  })
];

if (useCloudWatch) {
  transportsList.push(cloudWatchTransport);
}

export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: structuredFormat,
  defaultMeta: {
    service: 'expose-backend',
    environment: process.env.NODE_ENV || 'development'
  },
  transports: transportsList as any
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