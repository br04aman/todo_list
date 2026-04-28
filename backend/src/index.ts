import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { prisma } from './lib/db';
import { redis } from './lib/redis';
import { initializePassport } from './lib/passport';
import authRouter from './routes/auth';
import taskRouter from './routes/tasks';
import paymentRouter from './routes/payments';

const app = express();
const PORT = process.env.PORT || 4000;
const FRONTEND_URL = (process.env.FRONTEND_URL || 'http://localhost:3000').replace(/\/$/, '');


// ——— Middleware ———
app.use(cors({
  origin: (origin, callback) => {
    // Allow same-origin (Vercel serverless), no-origin (server-to-server), and configured frontend URL
    if (!origin || origin === FRONTEND_URL) {
      callback(null, true);
    } else {
      // Also allow any Vercel preview URLs for the same project
      callback(null, true);
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(express.json());
app.use(cookieParser());

// ——— Passport (OAuth) ———
initializePassport(app);

// ——— Routes ———
app.use('/api/auth', authRouter);
app.use('/api/tasks', taskRouter);
app.use('/api/payments', paymentRouter);

// ——— Health Check ———
app.get('/api/health', async (_req, res) => {
  try {
    // check DB
    await prisma.$queryRaw`SELECT 1`;
    // check Redis
    await redis.ping();
    res.json({ status: 'healthy', timestamp: new Date().toISOString() });
  } catch (error: any) {
    res.status(503).json({ status: 'unhealthy', error: error.message });
  }
});

// ——— Global Error Handler (prevents serverless crash on unhandled errors) ———
app.use((err: any, _req: any, res: any, _next: any) => {
  console.error('[Server] Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error', message: err.message || 'Unknown error' });
});

export default app;
