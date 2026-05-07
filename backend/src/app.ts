import express from 'express';
import authRoutes from './routes/auth.routes';
import path from 'path';
import uploadRoutes from './routes/upload.routes';
import { UPLOAD_DIR } from './config/env';
import healthRoutes from './routes/health.routes';
import postRoutes from './routes/post.routes';
import userRoutes from './routes/user.routes';
import messageRoutes from './routes/message.routes';
import relationshipRoutes from './routes/relationship.routes';
import { logger, requestLogger } from './config/logger';
import errorHandler from './middlewares/error.middleware';

const app = express();

logger.info('Application initializing', {
  environment: process.env.NODE_ENV || 'development',
  hostname: process.env.HOSTNAME || '',
});

app.use(express.json());


app.use(requestLogger);

app.use('/api/auth', authRoutes);
app.use('/api/posts', postRoutes);
app.use('/api/users', userRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/relationships', relationshipRoutes);
app.use('/uploads', express.static(path.resolve(UPLOAD_DIR)));
app.use('/upload', uploadRoutes);
app.use('/health', healthRoutes);


app.use(errorHandler);

export default app;