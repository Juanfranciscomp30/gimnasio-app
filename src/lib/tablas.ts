import { WeeklyPlan } from '@prisma/client';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

/**
 * Cuántos días de entrenamiento tiene la tabla de cada tarifa. La tabla de
 * la tarifa de 2 días tiene "Día 1" y "Día 2", la de 3 días uno más, etc.
 */
export const DIAS_POR_PLAN: Record<WeeklyPlan, number> = {
  ONE_DAY: 1,
  TWO_DAYS: 2,
  THREE_DAYS: 3,
};

/**
 * Cómo se piden siempre las tablas: días en orden y ejercicios en el
 * orden que les dio el admin, con los datos del ejercicio del catálogo.
 */
export const INCLUDE_TABLA = {
  days: {
    orderBy: { dayNumber: 'asc' as const },
    include: {
      exercises: {
        orderBy: { order: 'asc' as const },
        include: { exercise: true },
      },
    },
  },
};

/**
 * Convierte "2026-10-26" en la fecha que guardamos en SetLog.sessionDate
 * (columna DATE, sin hora). Usamos medianoche UTC para que el día no se
 * desplace por la zona horaria del servidor (Vercel corre en UTC, el
 * gimnasio está en España).
 */
export function fechaSesion(dia: string): Date {
  return new Date(`${dia}T00:00:00.000Z`);
}

/** Inversa de fechaSesion: Date de una columna DATE -> "2026-10-26". */
export function diaISO(fecha: Date): string {
  return fecha.toISOString().slice(0, 10);
}

export const REGEX_DIA = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Año y mes (1-12) a partir de los query params, o el mes actual si no
 * vienen. El cliente manda el suyo para que "este mes" sea el de España
 * y no el del servidor.
 */
export function leerMes(url: string): { year: number; month: number } | null {
  const params = new URL(url).searchParams;
  const ahora = new Date();
  const year = Number(params.get('year') ?? ahora.getFullYear());
  const month = Number(params.get('month') ?? ahora.getMonth() + 1);
  if (!Number.isInteger(year) || year < 2000 || year > 2100) return null;
  if (!Number.isInteger(month) || month < 1 || month > 12) return null;
  return { year, month };
}

export async function requireAdmin() {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any).role !== 'ADMIN') return null;
  return session;
}

export async function requireUserId(): Promise<string | null> {
  const session = await getServerSession(authOptions);
  return (session?.user as any)?.id ?? null;
}
