import { PrismaClient } from '@prisma/client';
import { performance } from 'perf_hooks';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

export async function disconnectPrisma() {
  await prisma.$disconnect();
}

const slowDbMs = Number(process.env.SLOW_DB_MS ?? 200);

(prisma as any).$use?.(async (params: any, next: any) => {
  const start = performance.now();
  const result = await next(params);
  const duration = performance.now() - start;
  if (duration > slowDbMs) {
    console.warn(`[db] ${params.model ?? 'raw'}.${params.action} ${duration.toFixed(1)}ms`);
  }
  return result;
});
