import { WeeklyPlan } from '@prisma/client';

/**
 * Precio fijo según la tarifa contratada.
 * Si tu primo cambia los precios del gimnasio, solo hay que tocar esto.
 */
export const PRECIO_POR_PLAN: Record<WeeklyPlan, number> = {
  ONE_DAY: 25,
  TWO_DAYS: 40,
  THREE_DAYS: 55,
};

/**
 * Un pago cubre un mes desde el día en que se paga.
 * Ej: si se paga el 13 de agosto, es válido hasta el 13 de septiembre.
 */
export function calcularValidoHasta(fechaPago: Date): Date {
  const fin = new Date(fechaPago);
  fin.setMonth(fin.getMonth() + 1);
  return fin;
}

/**
 * Compara la fecha de vencimiento con "ahora" para saber si el pago
 * de un usuario ya venció.
 */
export function estaVencido(validUntil: Date, ahora: Date = new Date()): boolean {
  return validUntil.getTime() < ahora.getTime();
}

/**
 * Detecta si un pago está a punto de vencer (por defecto, en los
 * próximos 3 días), para poder avisar antes de que sea tarde.
 * Si ya venció, esto devuelve false (para eso ya está estaVencido).
 */
export function venceProto(
  validUntil: Date,
  ahora: Date = new Date(),
  diasAviso: number = 3
): boolean {
  const msRestantes = validUntil.getTime() - ahora.getTime();
  const diasRestantes = msRestantes / (1000 * 60 * 60 * 24);
  return diasRestantes >= 0 && diasRestantes <= diasAviso;
}