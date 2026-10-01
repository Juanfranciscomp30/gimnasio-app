import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';

// ─────────────────────────────────────────────────────────────────────
// Cliente de IA (Claude) — único punto de la app que habla con la API.
//
// Si algún día queremos cambiar de modelo basta con tocar ANTHROPIC_MODEL
// en el .env; si queremos cambiar de proveedor, solo hay que reescribir
// este archivo y el resto de la app sigue igual.
// ─────────────────────────────────────────────────────────────────────

// Haiku es el modelo pequeño y barato: para planes de entreno y avisos
// cortos sobra, y para un gimnasio pequeño el coste son céntimos al mes.
const MODELO_POR_DEFECTO = 'claude-haiku-4-5';

let cliente: Anthropic | null = null;

function getCliente(): Anthropic {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new IaNoConfiguradaError();
  }
  // Igual que con Prisma: una única instancia reutilizada.
  if (!cliente) {
    cliente = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return cliente;
}

export class IaNoConfiguradaError extends Error {
  constructor() {
    super('La IA no está configurada (falta ANTHROPIC_API_KEY en el .env)');
  }
}

export function iaDisponible(): boolean {
  return !!process.env.ANTHROPIC_API_KEY;
}

type GenerarJSONOpciones<T extends z.ZodTypeAny> = {
  system: string;
  prompt: string;
  // Nombre corto de la "herramienta" que obligamos a usar (ej: 'guardar_plan')
  nombre: string;
  descripcion: string;
  // JSON Schema que ve el modelo (cómo debe ser la respuesta)...
  jsonSchema: Record<string, unknown>;
  // ...y el mismo esquema en zod, para validarlo de nuestro lado.
  zodSchema: T;
  maxTokens?: number;
};

/**
 * Pide a Claude una respuesta con forma de JSON y la valida con zod.
 *
 * Truco: en lugar de pedir "devuélveme JSON" en texto (y rezar para que
 * no añada nada más), le damos una "herramienta" con un esquema y le
 * OBLIGAMOS a usarla (tool_choice). La API nos devuelve directamente el
 * objeto que el modelo rellenó, sin tener que parsear texto.
 */
export async function generarJSON<T extends z.ZodTypeAny>(
  opciones: GenerarJSONOpciones<T>
): Promise<z.infer<T>> {
  const respuesta = await getCliente().messages.create({
    model: process.env.ANTHROPIC_MODEL || MODELO_POR_DEFECTO,
    max_tokens: opciones.maxTokens ?? 2000,
    system: opciones.system,
    tools: [
      {
        name: opciones.nombre,
        description: opciones.descripcion,
        input_schema: opciones.jsonSchema as Anthropic.Tool.InputSchema,
      },
    ],
    tool_choice: { type: 'tool', name: opciones.nombre },
    messages: [{ role: 'user', content: opciones.prompt }],
  });

  const bloque = respuesta.content.find((b) => b.type === 'tool_use');
  if (!bloque || bloque.type !== 'tool_use') {
    throw new Error('La IA no devolvió una respuesta con el formato esperado');
  }

  // Si el modelo se salta algún campo, zod lanza y lo tratamos como error 502.
  return opciones.zodSchema.parse(bloque.input);
}

// Instrucciones comunes a todo lo que generamos para el socio.
export const SYSTEM_BASE = `Eres el entrenador virtual de un gimnasio pequeño de clases reducidas (máximo 4 personas por clase).
Escribes siempre en español de España, con tono cercano, motivador y directo, tuteando.
Tus recomendaciones son generales y orientativas: nunca diagnosticas, no recetas suplementos ni medicamentos y,
si el socio menciona molestias o limitaciones, propones alternativas suaves y le recomiendas consultarlo con un profesional sanitario o con el entrenador del gimnasio.`;
