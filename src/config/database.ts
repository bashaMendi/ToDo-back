import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';

declare global {
  var __prisma: PrismaClient | undefined;
}

export const prisma = globalThis.__prisma || new PrismaClient({
  log: [
    {
      emit: 'event',
      level: 'query',
    },
    {
      emit: 'event',
      level: 'error',
    },
    {
      emit: 'event',
      level: 'info',
    },
    {
      emit: 'event',
      level: 'warn',
    },
  ],
});

// Log queries in development
if (process.env.NODE_ENV === 'development') {
  (prisma as any).$on('query', (e: any) => {
    logger.info({
      query: e.query,
      params: e.params,
      duration: `${e.duration}ms`,
    });
  });
}

(prisma as any).$on('error', (e: any) => {
  logger.error({
    error: e.message,
    target: e.target,
  });
});

// Graceful shutdown
process.on('beforeExit', async () => {
  await prisma.$disconnect();
});

if (globalThis.__prisma === undefined) {
  globalThis.__prisma = prisma;
}

export default prisma;
