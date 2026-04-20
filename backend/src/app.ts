import express from 'express';
import authRoutes from './modules/auth/auth.routes';
import followRoutes from './routes/follow.routes';


const app = express();

app.use(express.json());

app.use('/api/auth', authRoutes);

app.use('/follow', followRoutes);

export default app;