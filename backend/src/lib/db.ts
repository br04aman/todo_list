import { PrismaClient } from '@prisma/client';

export const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'info', 'warn', 'error'] : ['error'],
});

prisma.$connect()
  .then(() => console.log('[Prisma] Connected to PostgreSQL'))
  .catch((err: any) => console.error('[Prisma] Connection error:', err));
