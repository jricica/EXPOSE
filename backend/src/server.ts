import express, { Request, Response } from 'express';
import cors from 'cors';
import authRoutes from './routes/auth.routes';
import postRoutes from './routes/post.routes';
import uploadRoutes from './routes/upload.routes';

import path from 'path';

const app = express();

app.use(cors());
app.use(express.json());

// Serve static files from the frontend build
const frontendPath = path.join(__dirname, '../../frontend/dist');
app.use(express.static(frontendPath));

app.get('/api/health', (req: Request, res: Response) => {
    res.json({ status: 'API is running' });
});

app.use('/api/auth', authRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api', postRoutes);

// Serve the frontend for any non-API routes (SPA support)
app.use((req: Request, res: Response, next) => {
    if (req.path.startsWith('/api')) {
        return next();
    }
    res.sendFile(path.join(frontendPath, 'index.html'));
});

export default app;