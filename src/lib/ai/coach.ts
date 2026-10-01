import { z } from 'zod';
import { generarJSON, SYSTEM_BASE } from '@/lib/ai/client';
import type { PlanEntreno, PlanNutricion } from '@/lib/ai/opciones';

// ─── Plan de entrenamiento semanal ─────────────────────────────────────

const planEntrenoZod = z.object({
  resumen: z.string(),
  sesiones: z
    .array(
      z.object({
        titulo: z.string(),
        enfoque: z.string(),
        calentamiento: z.string(),
        ejercicios: z
          .array(z.object({ nombre: z.string(), series: z.string(), nota: z.string().optional() }))
          .min(1),
      })
    )
    .min(1),
  extraEnCasa: z
    .object({ titulo: z.string(), ejercicios: z.array(z.string()) })
    .nullable()
    .optional(),
  consejo: z.string(),
});

const planEntrenoSchema = {
  type: 'object',
  properties: {
    resumen: { type: 'string', description: '1-2 frases explicando el enfoque de la semana' },
    sesiones: {
      type: 'array',
      description: 'Una sesión por cada día de clase de su tarifa',
      items: {
        type: 'object',
        properties: {
          titulo: { type: 'string', description: 'Ej: "Día 1 · Tren inferior"' },
          enfoque: { type: 'string' },
          calentamiento: { type: 'string', description: 'Calentamiento breve en una frase' },
          ejercicios: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                nombre: { type: 'string' },
                series: { type: 'string', description: 'Ej: "4 x 10" o "3 x 30 s"' },
                nota: { type: 'string', description: 'Consejo técnico corto (opcional)' },
              },
              required: ['nombre', 'series'],
            },
          },
        },
        required: ['titulo', 'enfoque', 'calentamiento', 'ejercicios'],
      },
    },
    extraEnCasa: {
      type: 'object',
      description: 'Rutina corta (15-20 min) sin material para casa. Omítelo si el socio no la quiere.',
      properties: {
        titulo: { type: 'string' },
        ejercicios: { type: 'array', items: { type: 'string' } },
      },
      required: ['titulo', 'ejercicios'],
    },
    consejo: { type: 'string', description: 'Un consejo motivador personalizado de 1-2 frases' },
  },
  required: ['resumen', 'sesiones', 'consejo'],
};

export async function generarPlanEntreno(contexto: string, diasSemana: number): Promise<PlanEntreno> {
  return generarJSON({
    system: SYSTEM_BASE,
    nombre: 'guardar_plan_entreno',
    descripcion: 'Guarda el plan de entrenamiento semanal del socio',
    jsonSchema: planEntrenoSchema,
    zodSchema: planEntrenoZod,
    maxTokens: 2500,
    prompt: `Diseña el plan de entrenamiento de esta semana para este socio.

${contexto}

Reglas:
- Exactamente ${diasSemana} sesión(es), una por día de clase, que se complementen entre sí (no repitas el mismo grupo muscular dos días seguidos si hay varias).
- Entre 4 y 6 ejercicios por sesión, ajustados a su nivel y a la duración indicada. Material típico de un box pequeño: mancuernas, kettlebells, barra, bandas, comba, banco.
- Si ha faltado mucho últimamente, empieza más suave y díselo en positivo en el consejo.
- Si no ha rellenado su perfil, asume nivel principiante y objetivo de mejorar la forma física.`,
  });
}

// ─── Sugerencias de nutrición ─────────────────────────────────────────

const planNutricionZod = z.object({
  resumen: z.string(),
  claves: z.array(z.string()).min(1),
  ejemploDia: z.array(z.object({ comida: z.string(), idea: z.string() })).min(1),
  diaDeEntreno: z.string(),
  aviso: z.string(),
});

const planNutricionSchema = {
  type: 'object',
  properties: {
    resumen: { type: 'string', description: '1-2 frases con el enfoque general' },
    claves: {
      type: 'array',
      items: { type: 'string' },
      description: '3-5 hábitos concretos y fáciles de aplicar',
    },
    ejemploDia: {
      type: 'array',
      description: 'Ejemplo de un día: desayuno, comida, merienda y cena',
      items: {
        type: 'object',
        properties: { comida: { type: 'string' }, idea: { type: 'string' } },
        required: ['comida', 'idea'],
      },
    },
    diaDeEntreno: { type: 'string', description: 'Qué comer antes/después de la clase' },
    aviso: {
      type: 'string',
      description: 'Recordatorio de que son ideas generales y que para un plan a medida debe acudir a un dietista-nutricionista',
    },
  },
  required: ['resumen', 'claves', 'ejemploDia', 'diaDeEntreno', 'aviso'],
};

export async function generarPlanNutricion(contexto: string): Promise<PlanNutricion> {
  return generarJSON({
    system: SYSTEM_BASE,
    nombre: 'guardar_plan_nutricion',
    descripcion: 'Guarda las sugerencias de nutrición del socio',
    jsonSchema: planNutricionSchema,
    zodSchema: planNutricionZod,
    maxTokens: 1500,
    prompt: `Propón sugerencias de alimentación para esta semana a este socio, coherentes con su objetivo y su preferencia de alimentación.

${contexto}

Reglas:
- Ideas sencillas de cocina mediterránea/española, con alimentos de supermercado normal.
- Sin cifras de calorías ni dietas restrictivas; habla de raciones y hábitos.
- Si indica alguna limitación, no la interpretes como un diagnóstico: limítate a recomendarle consultarlo con un profesional.`,
  });
}
