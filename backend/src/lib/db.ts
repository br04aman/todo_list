import { PrismaClient } from '@prisma/client';

export const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'info', 'warn', 'error'] : ['error'],
});

// In serverless (Vercel), Prisma auto-connects on first query.
// Eager $connect() can crash the cold-start if the DB is momentarily unreachable.
if (process.env.NODE_ENV === 'development') {
  prisma.$connect()
    .then(() => console.log('[Prisma] Connected to PostgreSQL'))
    .catch((err: any) => console.error('[Prisma] Connection error:', err));
}
