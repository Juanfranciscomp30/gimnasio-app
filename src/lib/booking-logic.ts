/**
 * Lógica de negocio central de reservas.
 * Esto es la "fuente de la verdad" de las reglas del gimnasio.
 * Las rutas de la API (src/app/api/bookings) deben apoyarse en estas funciones,
 * no reimplementar la lógica ahí.
 */

const HORAS_LIMITE_CANCELACION = 3;

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
