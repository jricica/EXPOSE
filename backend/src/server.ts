import express, { Request, Response } from 'express';
import authRoutes from './routes/auth.routes';

const app = express();

app.use(express.json());
app.use('/user/v1', authRoutes);

app.get('/', (req: Request, res: Response) => {
    res.send('Hello, World!');
});

export default app;