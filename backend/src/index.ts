import dotenv from 'dotenv';
dotenv.config();

import app from './server';
import { logger } from './config/logger';
import { GracefulShutdown, shutdownMiddleware } from './middlewares/graceful-shutdown.middleware';

// Add shutdown middleware to the app
const gracefulShutdown = new GracefulShutdown(null); // Will be set after server starts
app.use(shutdownMiddleware(gracefulShutdown));

const PORT = process.env.PORT || 3000;

// Start the server
const server = app.listen(PORT, () => {
  logger.info('Server started successfully', {
    port: PORT,
    environment: process.env.NODE_ENV || 'development',
    nodeVersion: process.version,
    platform: process.platform
  });
});

// Initialize graceful shutdown with the server instance
gracefulShutdown.setServer(server);

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', { reason, promise });
  gracefulShutdown.triggerShutdown(1);
});

process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', { error: error.message, stack: error.stack });
  gracefulShutdown.triggerShutdown(1);
});

export default app;
