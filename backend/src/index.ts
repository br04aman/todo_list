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
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

// ——— Middleware ———
app.use(cors({
  origin: FRONTEND_URL,
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

// ——— Start Server ———
async function start() {
  try {
    // Connect Redis (lazy connect mode)
    await redis.connect();
    console.log(`[Server] Redis connected`);

    // Verify DB connection
    await prisma.$connect();
    console.log(`[Server] PostgreSQL connected`);

    app.listen(PORT, () => {
      console.log(`[Server] Backend running on http://localhost:${PORT}`);
      console.log(`[Server] Frontend origin: ${FRONTEND_URL}`);
    });
  } catch (error) {
    console.error('[Server] Failed to start:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('[Server] SIGTERM received, shutting down...');
  await prisma.$disconnect();
  redis.disconnect();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('[Server] SIGINT received, shutting down...');
  await prisma.$disconnect();
  redis.disconnect();
  process.exit(0);
});

start();
