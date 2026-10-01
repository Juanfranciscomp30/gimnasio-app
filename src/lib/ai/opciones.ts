// Opciones del cuestionario fitness. Este archivo NO importa nada de
// servidor (ni Prisma ni la API de IA) para poder usarlo también desde
// componentes 'use client'.

export const OBJETIVOS = {
  PERDER_GRASA: 'Perder grasa',
  GANAR_MUSCULO: 'Ganar músculo',
  MEJORAR_FORMA: 'Mejorar mi forma física',
  SALUD_GENERAL: 'Salud y bienestar general',
} as const;

export const NIVELES = {
  PRINCIPIANTE: 'Principiante',
  INTERMEDIO: 'Intermedio',
  AVANZADO: 'Avanzado',
} as const;

export const DIETAS = {
  SIN_PREFERENCIA: 'Sin preferencia',
  OMNIVORA: 'Omnívora',
  VEGETARIANA: 'Vegetariana',
  VEGANA: 'Vegana',
} as const;

export const MINUTOS_SESION = [30, 45, 60, 90] as const;

export type Objetivo = keyof typeof OBJETIVOS;
export type Nivel = keyof typeof NIVELES;
export type Dieta = keyof typeof DIETAS;

// Cuántos planes de cada tipo puede generar un socio por semana.
// Es la forma de controlar el gasto de la API: suficiente para
// regenerar si no le gusta, pero sin que nadie pueda abusar.
export const MAX_GENERACIONES_SEMANA = 3;

// ─── Forma de los planes que devuelve la IA (compartida con el front) ──

export type PlanEntreno = {
  resumen: string;
  sesiones: {
    titulo: string;
    enfoque: string;
    calentamiento: string;
    ejercicios: { nombre: string; series: string; nota?: string }[];
  }[];
  extraEnCasa?: { titulo: string; ejercicios: string[] } | null;
  consejo: string;
};

export type PlanNutricion = {
  resumen: string;
  claves: string[];
  ejemploDia: { comida: string; idea: string }[];
  diaDeEntreno: string;
  aviso: string;
};
