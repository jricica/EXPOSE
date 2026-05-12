import express, { Request, Response } from 'express';
import cors from 'cors';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import path from 'path';

// Import routes
import authRoutes from './routes/auth.routes';
import postRoutes from './routes/post.routes';
import uploadRoutes from './routes/upload.routes';
import relationshipRoutes from './routes/relationship.routes';
import messageRoutes from './routes/message.routes';
import healthRoutes from './routes/health.routes';
import userRoutes from './routes/user.routes';

// Import middlewares
import { requestLogger } from './config/logger';
import { GracefulShutdown, shutdownMiddleware } from './middlewares/graceful-shutdown.middleware';

// Import instrumentation
import './instrument'; // Sentry initialization

// Create Express app
const app = express();

// Trust proxy for accurate IP addresses behind ALB
app.set('trust proxy', 1);

// Security headers
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  next();
});

// CORS configuration (restrictive for production)
const corsOptions = {
  origin: process.env.NODE_ENV === 'production'
    ? process.env.ALLOWED_ORIGINS?.split(',') || []
    : ['http://localhost:3000', 'http://localhost:5173'], // Allow local development
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
};
app.use(cors(corsOptions));

// Compression middleware
app.use(compression({
  level: 6, // Good balance between speed and compression
  threshold: 1024, // Only compress responses > 1KB
  filter: (req: express.Request, res: express.Response) => {
    // Don't compress responses with this request header
    if (req.headers['x-no-compression']) {
      return false;
    }
    // Use compression filter function
    return compression.filter(req, res);
  }
}));

// Rate limiting
const limiter = rateLimit({
  //windowMs: 15 * 60 * 100, // 15 minutes
  //max: 1000000000000, // Limit each IP to 10000 requests per windowMs
  message: {
    error: 'Too many requests from this IP, please try again later.',
    retryAfter: 15 * 60 // seconds
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  skip: (req: express.Request) => {
    // Skip rate limiting for health checks
    return req.path === '/api/health' || req.path === '/api/ready';
  }
});
app.use('/api/', limiter);

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging
app.use(requestLogger);

if (process.env.NODE_ENV !== 'production') {
  const frontendPath = path.join(__dirname, '../../frontend/dist');
  app.use(express.static(frontendPath, { setHeaders: (res) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
  }}));
}

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api', postRoutes);
app.use('/api/relationships', relationshipRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api', userRoutes);
app.use('/api', healthRoutes);

// Health check (legacy endpoint for backward compatibility)
app.get('/health', (req: Request, res: Response) => {
  res.redirect('/api/health');
});

// Serve the frontend for any non-API routes (SPA support)
app.use((req: Request, res: Response, next) => {
  if (req.path.startsWith('/api') || req.path.startsWith('/health')) {
    return next();
  }

  if (process.env.NODE_ENV === 'production') {
    // In production, serve a simple message or redirect to frontend
    res.status(200).json({
      message: 'EXPOSE API',
      version: process.env.npm_package_version || '1.0.0',
      docs: '/api/health'
    });
  } else {
    // In development, serve the frontend
    const frontendPath = path.join(__dirname, '../../frontend/dist');
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.sendFile(path.join(frontendPath, 'index.html'));
  }
});

// Error handling middleware
app.use((err: any, req: Request, res: Response, next: any) => {
  console.error('Unhandled error:', err);

  // Don't leak error details in production
  const isDevelopment = process.env.NODE_ENV !== 'production';

  res.status(err.status || 500).json({
    error: err.message || 'Internal Server Error',
    ...(isDevelopment && { stack: err.stack }),
    timestamp: new Date().toISOString(),
    path: req.path,
    method: req.method
  });
});

// 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Route ${req.method} ${req.path} not found`,
    timestamp: new Date().toISOString()
  });
});

export default app;
