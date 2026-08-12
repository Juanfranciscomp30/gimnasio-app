import { PrismaClient } from '@prisma/client';

// En desarrollo, Next.js recarga módulos constantemente (hot-reload).
// Sin este truco, cada recarga crearía una nueva conexión a la base de datos
// y acabaríamos agotando las conexiones disponibles en Supabase.
// Por eso guardamos una única instancia en el objeto global.

const globalForPrisma = global as unknown as { prisma: PrismaClient };

export const prisma = globalForPrisma.prisma || new PrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}