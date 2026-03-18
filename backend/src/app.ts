import express from 'express';
import authRoutes from './modules/auth/auth.routes';
import followRoutes from './routes/follow.routes';
import path from 'path';
import uploadRoutes from './routes/upload.routes';


const app = express();

app.use(express.json());

app.use('/api/auth', authRoutes);

app.use('/follow', followRoutes);

app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

app.use('/upload', uploadRoutes);

export default app;