/**
 * Lógica de negocio central de reservas.
 * Esto es la "fuente de la verdad" de las reglas del gimnasio.
 * Las rutas de la API (src/app/api/bookings) deben apoyarse en estas funciones,
 * no reimplementar la lógica ahí.
 */

import { prisma } from './prisma';
import { estaVencido } from './payment-logic';

// Exportada para que /inicio pueda avisar con la misma referencia horaria
// que usa la regla de cancelación, en vez de duplicar el número "3" a mano.
export const HORAS_LIMITE_CANCELACION = 3;

/**
 * Determina si una cancelación se considera "a tiempo" o "tardía".
 * - A tiempo (>= 3h antes de la clase): libera el hueco Y no consume el día del usuario.
 * - Tardía (< 3h antes de la clase): libera el hueco para otros, pero el usuario
 *   pierde ese día igualmente (cuenta como usado dentro de su tarifa semanal).
 */
export function esCancelacionTardia(fechaClase: Date, ahora: Date = new Date()): boolean {
  const msHastaClase = fechaClase.getTime() - ahora.getTime();
  const horasHastaClase = msHastaClase / (1000 * 60 * 60);
  return horasHastaClase < HORAS_LIMITE_CANCELACION;
}

/**
 * Límite de días/semana según la tarifa contratada.
 */
export const LIMITE_POR_PLAN: Record<'ONE_DAY' | 'TWO_DAYS' | 'THREE_DAYS', number> = {
  ONE_DAY: 1,
  TWO_DAYS: 2,
  THREE_DAYS: 3,
};

/**
 * Un usuario solo puede reservar si:
 * 1. Le quedan huecos disponibles en su plan semanal (reservas CONFIRMED o CANCELLED_LATE
 *    de esa semana < límite de su plan).
 * 2. La clase tiene aforo libre (bookings CONFIRMED de esa ClassSession < capacity).
 *
 * Nota: CANCELLED_ON_TIME NO cuenta para el límite semanal (se libera el día).
 *       CANCELLED_LATE SÍ cuenta para el límite semanal (se pierde el día),
 *       pero el hueco de aforo de la clase se libera en ambos casos.
 */

/**
 * Devuelve el lunes (00:00:00) de la semana a la que pertenece la fecha dada.
 * Usamos lunes como inicio de semana (estándar en España/Europa).
 */
export function inicioDeSemana(fecha: Date): Date {
  const d = new Date(fecha);
  const diaSemana = d.getDay(); // 0 = domingo, 1 = lunes, ... 6 = sábado
  const diferencia = diaSemana === 0 ? -6 : 1 - diaSemana;
  d.setDate(d.getDate() + diferencia);
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Devuelve el inicio de la semana SIGUIENTE (límite exclusivo), útil para
 * hacer consultas tipo "fecha >= inicio Y fecha < fin".
 */
export function finDeSemana(fecha: Date): Date {
  const inicio = inicioDeSemana(fecha);
  const fin = new Date(inicio);
  fin.setDate(fin.getDate() + 7);
  return fin;
}

/**
 * Genera las fechas+hora para una serie de clases recurrentes.
 * daysOfWeek usa el mismo formato que Date.getDay(): 0 = domingo ... 6 = sábado.
 * Descarta automáticamente cualquier fecha que ya haya pasado.
 */
export function generarFechasRecurrentes({
  startDate,
  daysOfWeek,
  time,
  endDate,
}: {
  startDate: Date;
  daysOfWeek: number[];
  time: string; // "HH:MM"
  endDate: Date;
}): Date[] {
  const [horas, minutos] = time.split(':').map(Number);
  const fechas: Date[] = [];
  const MAX_CLASES = 200; // límite de seguridad por si hay un error en las fechas

  const cursor = new Date(startDate);
  cursor.setHours(0, 0, 0, 0);

  while (cursor <= endDate && fechas.length < MAX_CLASES) {
    if (daysOfWeek.includes(cursor.getDay())) {
      const fecha = new Date(cursor);
      fecha.setHours(horas, minutos, 0, 0);
      if (fecha.getTime() > Date.now()) {
        fechas.push(fecha);
      }
    }
    cursor.setDate(cursor.getDate() + 1);
  }

  return fechas;
}

/**
 * Se acaba de liberar un hueco en una clase (por cancelación o por un
 * cambio de reserva): si hay gente en lista de espera, promocionamos al
 * primero (por orden de llegada) que sea elegible de verdad -> pago al
 * día, sin baja pendiente, y que no haya agotado ya su límite semanal.
 * Si el primero no es elegible, probamos con el siguiente, hasta
 * encontrar uno o quedarnos sin candidatos.
 *
 * Compartida entre la cancelación normal (PATCH /api/bookings/[id]) y el
 * cambio de reserva (PATCH /api/bookings/[id]/move), para no duplicar la
 * misma regla de negocio en dos sitios.
 */
export async function promocionarSiguienteEnEspera(classSessionId: string, fechaClase: Date) {
  const enEspera = await prisma.booking.findMany({
    where: { classSessionId, status: 'WAITLISTED' },
    orderBy: { createdAt: 'asc' },
    take: 10,
  });

  const inicioSemana = inicioDeSemana(fechaClase);
  const finSemana = finDeSemana(fechaClase);

  for (const candidato of enEspera) {
    const usuario = await prisma.user.findUnique({ where: { id: candidato.userId } });
    if (!usuario || usuario.cancellationRequested) continue;

    const ultimoPago = await prisma.payment.findFirst({
      where: { userId: candidato.userId },
      orderBy: { paidAt: 'desc' },
    });
    if (!ultimoPago || estaVencido(ultimoPago.validUntil)) continue;

    const usadasEstaSemana = await prisma.booking.count({
      where: {
        userId: candidato.userId,
        status: { in: ['CONFIRMED', 'CANCELLED_LATE'] },
        classSession: { date: { gte: inicioSemana, lt: finSemana } },
      },
    });
    if (usadasEstaSemana >= LIMITE_POR_PLAN[usuario.weeklyPlan]) continue;

    await prisma.booking.update({
      where: { id: candidato.id },
      data: { status: 'CONFIRMED', cancelledAt: null },
    });
    return; // solo se ha liberado 1 plaza, promocionamos a un único candidato
  }
}
