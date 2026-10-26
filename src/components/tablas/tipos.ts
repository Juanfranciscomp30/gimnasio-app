// Tipos y textos compartidos por las pantallas de tablas de ejercicios
// (admin y socio). Reflejan lo que devuelven las APIs de /api/routines,
// /api/exercises y /api/workout-logs.

export type Plan = 'ONE_DAY' | 'TWO_DAYS' | 'THREE_DAYS';

export const PLANES: Plan[] = ['ONE_DAY', 'TWO_DAYS', 'THREE_DAYS'];

// Versión de la tabla: el gimnasio hace tablas distintas para hombre y mujer
export type Variante = 'MEN' | 'WOMEN';

export const VARIANTES: Variante[] = ['MEN', 'WOMEN'];

export const ETIQUETA_VARIANTE: Record<Variante, string> = {
  MEN: 'Hombre',
  WOMEN: 'Mujer',
};

export const ETIQUETA_PLAN: Record<Plan, string> = {
  ONE_DAY: '1 día/semana',
  TWO_DAYS: '2 días/semana',
  THREE_DAYS: '3 días/semana',
};

export const DIAS_POR_PLAN: Record<Plan, number> = {
  ONE_DAY: 1,
  TWO_DAYS: 2,
  THREE_DAYS: 3,
};

export const MESES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

export type Ejercicio = {
  id: string;
  name: string;
  muscleGroup: string | null;
  notes: string | null;
  _count?: { routineExercises: number; setLogs: number };
};

export type EjercicioDeTabla = {
  id: string;
  exerciseId: string;
  order: number;
  block: number; // mismo número = se hacen seguidos (superserie)
  sets: number;
  reps: string | null;
  restSeconds: number | null;
  notes: string | null;
  exercise: Ejercicio;
};

export type DiaDeTabla = {
  id: string;
  dayNumber: number;
  name: string | null;
  exercises: EjercicioDeTabla[];
};

export type Tabla = {
  id: string;
  year: number;
  month: number;
  weeklyPlan: Plan;
  variant: Variante;
  title: string | null;
  notes: string | null;
  days: DiaDeTabla[];
};

/**
 * Agrupa los ejercicios de un día en bloques consecutivos con el mismo
 * número de bloque (los que se hacen seguidos, en superserie).
 */
export function agruparEnBloques<T extends { block: number }>(ejercicios: T[]): T[][] {
  const bloques: T[][] = [];
  for (const e of ejercicios) {
    const ultimo = bloques[bloques.length - 1];
    if (ultimo && ultimo[0].block === e.block) ultimo.push(e);
    else bloques.push([e]);
  }
  return bloques;
}

/** Letra del bloque para mostrarlo: A, B, C... */
export const letraBloque = (i: number) => String.fromCharCode(65 + i);

export type Serie = { setNumber: number; weight: number; reps: number };

export type HistorialEjercicio = {
  ultima: { date: string; sets: Serie[] } | null;
  hoy: Serie[];
  record: number | null;
};

export type ProgresoEjercicio = {
  exerciseId: string;
  name: string;
  muscleGroup: string | null;
  record: number;
  ultimaFecha: string;
  sesiones: { date: string; maxWeight: number; sets: { weight: number; reps: number }[] }[];
};

/** "2026-10-26" con la fecha local del dispositivo (no UTC). */
export function hoyISO(): string {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

/** "2026-09-12" -> "12 sep" (o "12 sep 2025" si es de otro año). */
export function fechaCorta(dia: string): string {
  const [y, m, d] = dia.split('-').map(Number);
  const fecha = new Date(y, m - 1, d);
  const opciones: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' };
  if (y !== new Date().getFullYear()) opciones.year = 'numeric';
  return fecha.toLocaleDateString('es-ES', opciones);
}

/** 42.5 -> "42,5" */
export function kg(peso: number): string {
  return peso.toLocaleString('es-ES', { maximumFractionDigits: 2 });
}
