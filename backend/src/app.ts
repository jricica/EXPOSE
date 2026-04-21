import express from 'express';
import authRoutes from './modules/auth/auth.routes';
import followRoutes from './routes/follow.routes';
import path from 'path';
import uploadRoutes from './routes/upload.routes';
import { UPLOAD_DIR } from './config/env';


const app = express();

app.use(express.json());

app.use('/api/auth', authRoutes);

app.use('/follow', followRoutes);

app.use('/uploads', express.static(path.resolve(UPLOAD_DIR)));

app.use('/upload', uploadRoutes);

export default app;