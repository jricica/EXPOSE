import express, { Request, Response } from 'express';
import authRoutes from './routes/auth.routes';
import postRoutes from './routes/post.routes';

const app = express();

app.use(express.json());

app.get('/', (req: Request, res: Response) => {
    res.send('API is running');
});

app.use('/api/auth', authRoutes);
app.use('/api', postRoutes);

export default app;
