import { logger } from '../config/logger';

interface GracefulShutdownOptions {
  timeout?: number;
  signals?: NodeJS.Signals[];
}

export class GracefulShutdown {
  private server: any;
  private timeout: number;
  private signals: NodeJS.Signals[];
  private shuttingDown = false;

  constructor(server: any, options: GracefulShutdownOptions = {}) {
    this.server = server;
    this.timeout = options.timeout || 30000; // 30 seconds default
    this.signals = options.signals || ['SIGTERM', 'SIGINT'];

    this.setupSignalHandlers();
  }

  // Public method to set server
  public setServer(server: any) {
    this.server = server;
  }

  // Public method to trigger shutdown
  public triggerShutdown(exitCode = 0) {
    this.shutdown(exitCode);
  }

  private setupSignalHandlers() {
    this.signals.forEach(signal => {
      process.on(signal, () => {
        logger.info(`Received ${signal}, initiating graceful shutdown...`);
        this.shutdown();
      });
    });

    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      logger.error('Uncaught Exception', { error: error.message, stack: error.stack });
      this.shutdown(1);
    });

    process.on('unhandledRejection', (reason, promise) => {
      logger.error('Unhandled Rejection', { reason, promise });
      this.shutdown(1);
    });
  }

  private shutdown(exitCode = 0) {
    if (this.shuttingDown) {
      logger.warn('Shutdown already in progress');
      return;
    }

    this.shuttingDown = true;
    logger.info('Starting graceful shutdown sequence...');

    // Stop accepting new connections
    this.server.close((err?: Error) => {
      if (err) {
        logger.error('Error closing server', { error: err.message });
        process.exit(1);
      }

      logger.info('Server closed, no longer accepting connections');

      // Give existing connections time to finish
      setTimeout(() => {
        logger.info('Graceful shutdown completed, exiting...');
        process.exit(exitCode);
      }, this.timeout);
    });

    // Force exit after timeout
    setTimeout(() => {
      logger.error('Forced shutdown after timeout');
      process.exit(1);
    }, this.timeout + 5000);
  }

  public isShuttingDown(): boolean {
    return this.shuttingDown;
  }
}

// Middleware to reject requests during shutdown
export const shutdownMiddleware = (gracefulShutdown: GracefulShutdown) => {
  return (req: any, res: any, next: any) => {
    if (gracefulShutdown.isShuttingDown()) {
      logger.warn('Rejecting request during shutdown', {
        method: req.method,
        url: req.url
      });
      res.status(503).json({
        error: 'Service Unavailable',
        message: 'Server is shutting down'
      });
      return;
    }
    next();
  };
};