import express from 'express';
import authRoutes from './routes/auth.routes';
import path from 'path';
import uploadRoutes from './routes/upload.routes';
import { UPLOAD_DIR } from './config/env';
import healthRoutes from "./routes/health.routes";
import { logger } from './config/logger';

const app = express();

// CloudWatch test log (appears on startup when USE_CLOUDWATCH=true and AWS creds are set)
logger.info('CloudWatch test log from app.ts', { environment: process.env.NODE_ENV || 'development', hostname: process.env.HOSTNAME || '' });

app.use(express.json());

app.use('/api/auth', authRoutes);

app.use('/uploads', express.static(path.resolve(UPLOAD_DIR)));

app.use('/upload', uploadRoutes);

app.use("/health", healthRoutes);

export default app;