import dotenv from 'dotenv';
dotenv.config();

import { loadSecrets } from './config/secrets';

const EXPIRED_POSTS_CLEANUP_INTERVAL_MS = 60 * 60 * 1000; // 1 hora

async function bootstrap() {
  // 1. Cargar secretos de base de datos desde AWS antes de inicializar la BD
  await loadSecrets();

  // 2. Importar el servidor dinámicamente ahora que process.env está listo
  const { default: app } = await import('./server');
  const { logger } = await import('./config/logger');
  const { GracefulShutdown, shutdownMiddleware } = await import('./middlewares/graceful-shutdown.middleware');

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

  // Cleanup de posts expirados cada hora
  const { postService } = await import('./services/post.service');
  setInterval(async () => {
    try {
      const { deleted } = await postService.purgeExpiredPosts();
      if (deleted > 0) {
        logger.info('Expired posts cleanup completed', { deleted });
      }
    } catch (error) {
      logger.error('Expired posts cleanup failed', { error });
    }
  }, EXPIRED_POSTS_CLEANUP_INTERVAL_MS);

  // Handle unhandled promise rejections
  process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled Rejection at:', { reason, promise });
    gracefulShutdown.triggerShutdown(1);
  });

  process.on('uncaughtException', (error) => {
    logger.error('Uncaught Exception:', { error: error.message, stack: error.stack });
    gracefulShutdown.triggerShutdown(1);
  });
}

bootstrap();

