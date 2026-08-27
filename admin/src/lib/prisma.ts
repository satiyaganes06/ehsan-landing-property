import { PrismaClient } from '@prisma/client';

// One client for the process. Fastify's plugin encapsulation would otherwise
// tempt a client per plugin, and Postgres connection pools are not free.
export const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
});
