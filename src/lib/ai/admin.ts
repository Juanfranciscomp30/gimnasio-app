import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { generarJSON } from '@/lib/ai/client';
import { LIMITE_POR_PLAN } from '@/lib/booking-logic';

const DIA_MS = 24 * 60 * 60 * 1000;

const SYSTEM_ADMIN = `Ayudas al dueño de un gimnasio pequeño de clases reducidas (máximo 4 personas por clase, tarifas de 1, 2 o 3 días por semana).
Escribes en español de España, con tono cercano y práctico. Eres concreto: cifras, días y horas reales, nada de frases genéricas.`;

// ═════════════════════════════════════════════════════════════════════
// 1) REACTIVACIÓN DE SOCIOS
// Primero detectamos candidatos con reglas normales (sin IA, gratis y
// predecible) y solo después la IA redacta el mensaje para cada uno.
// ═════════════════════════════════════════════════════════════════════

export type CandidatoReactivacion = {
  userId: string;
  nombre: string;
  motivos: string[];
};

export async function detectarCandidatosReactivacion(): Promise<CandidatoReactivacion[]> {
  const ahora = new Date();
  const hace14 = new Date(ahora.getTime() - 14 * DIA_MS);
  const hace30 = new Date(ahora.getTime() - 30 * DIA_MS);
  const hace42 = new Date(ahora.getTime() - 42 * DIA_MS);

  const usuarios = await prisma.user.findMany({
    where: { role: 'USER', emailVerified: { not: null } },
    select: {
      id: true,
      name: true,
      weeklyPlan: true,
      createdAt: true,
      cancellationRequested: true,
      bookings: {
        where: { classSession: { date: { gte: hace42, lte: ahora } } },
        select: { status: true, classSession: { select: { date: true } } },
      },
      payments: { orderBy: { paidAt: 'desc' }, take: 1, select: { validUntil: true } },
    },
  });

  const candidatos: CandidatoReactivacion[] = [];

  for (const u of usuarios) {
    const motivos: string[] = [];
    const asistidas = u.bookings.filter((b) => b.status === 'CONFIRMED');
    const recientes = asistidas.filter((b) => b.classSession.date >= hace14).length;
    const anteriores = asistidas.filter((b) => b.classSession.date < hace14).length; // 4 semanas previas
    const tardias = u.bookings.filter(
      (b) => b.status === 'CANCELLED_LATE' && b.classSession.date >= hace30
    ).length;
    const esNuevo = u.createdAt > hace14;

    if (u.cancellationRequested) motivos.push('Ha solicitado la baja');

    if (!esNuevo && recientes === 0) {
      motivos.push('No ha venido a ninguna clase en las últimas 2 semanas');
    } else if (anteriores >= 4 && recientes / 2 < (anteriores / 4) * 0.5) {
      motivos.push(`Viene bastante menos: ${recientes} clases en 2 semanas frente a ~${Math.round(anteriores / 2)} antes`);
    }

    if (tardias >= 2) motivos.push(`${tardias} cancelaciones tardías en el último mes`);

    const limite = LIMITE_POR_PLAN[u.weeklyPlan];
    if (recientes > 0 && recientes < limite * 2) {
      // No es motivo por sí solo, pero da contexto si ya hay otro motivo
      if (motivos.length) motivos.push(`Usa ${recientes} de ${limite * 2} clases de su tarifa en 2 semanas`);
    }

    const pago = u.payments[0];
    if (pago) {
      const dias = Math.round((pago.validUntil.getTime() - ahora.getTime()) / DIA_MS);
      if (dias < 0 && dias >= -15) motivos.push(`Cuota vencida hace ${-dias} días`);
      else if (dias >= 0 && dias <= 5) motivos.push(`Cuota vence en ${dias} días`);
    }

    if (motivos.length) candidatos.push({ userId: u.id, nombre: u.name, motivos });
  }

  // Primero los que acumulan más señales
  return candidatos.sort((a, b) => b.motivos.length - a.motivos.length).slice(0, 20);
}

const borradoresZod = z.object({
  mensajes: z.array(z.object({ userId: z.string(), mensaje: z.string().max(400) })),
});

export async function redactarMensajesReactivacion(candidatos: CandidatoReactivacion[]) {
  const listado = candidatos
    .map((c) => `- userId: ${c.userId} | nombre de pila: ${c.nombre.split(' ')[0]} | situación: ${c.motivos.join('; ')}`)
    .join('\n');

  const { mensajes } = await generarJSON({
    system: SYSTEM_ADMIN,
    nombre: 'guardar_mensajes',
    descripcion: 'Guarda un aviso personalizado por cada socio',
    maxTokens: 3000,
    zodSchema: borradoresZod,
    jsonSchema: {
      type: 'object',
      properties: {
        mensajes: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              userId: { type: 'string', description: 'El userId exacto del listado' },
              mensaje: { type: 'string', description: 'Máximo 280 caracteres' },
            },
            required: ['userId', 'mensaje'],
          },
        },
      },
      required: ['mensajes'],
    },
    prompt: `Redacta un aviso corto dentro de la app para cada uno de estos socios. Lo firmará el gimnasio.

${listado}

Reglas:
- Máximo 280 caracteres, tuteando, por su nombre de pila. Un emoji como mucho.
- Tono de "te echamos de menos", nunca de reproche ni de culpa. No menciones cifras de cancelaciones.
- Si su cuota vence o ha vencido, recuérdaselo con naturalidad.
- Si ha pedido la baja, pregúntale con cariño si hay algo que podamos mejorar, sin presionar.
- Termina con una invitación concreta (reservar su próxima clase, pasarse a saludar...).`,
  });

  // Nos quedamos solo con userIds que realmente pedimos (por si la IA inventa)
  const validos = new Set(candidatos.map((c) => c.userId));
  return mensajes.filter((m) => validos.has(m.userId));
}

// ═════════════════════════════════════════════════════════════════════
// 2) RESUMEN SEMANAL PARA EL ADMIN
// ═════════════════════════════════════════════════════════════════════

export type ResumenIA = {
  titular: string;
  puntos: { tipo: 'bien' | 'atencion' | 'idea'; texto: string }[];
  acciones: string[];
};

const resumenZod = z.object({
  titular: z.string(),
  puntos: z.array(z.object({ tipo: z.enum(['bien', 'atencion', 'idea']), texto: z.string() })),
  acciones: z.array(z.string()),
});

// Calcula las cifras con Prisma (exactas) y deja a la IA solo la parte
// de interpretarlas y proponer qué hacer. Así nunca se "inventa" números.
async function datosSemana() {
  const ahora = new Date();
  const hace28 = new Date(ahora.getTime() - 28 * DIA_MS);
  const en7 = new Date(ahora.getTime() + 7 * DIA_MS);
  const hace7 = new Date(ahora.getTime() - 7 * DIA_MS);
  const inicioMes = new Date(ahora.getFullYear(), ahora.getMonth(), 1);

  const [clases, ingresos, gastos, socios, pagos] = await Promise.all([
    prisma.classSession.findMany({
      where: { date: { gte: hace28, lt: en7 }, cancelled: false },
      select: {
        date: true,
        capacity: true,
        bookings: { select: { status: true } },
      },
    }),
    prisma.payment.aggregate({ _sum: { amount: true }, where: { paidAt: { gte: inicioMes } } }),
    prisma.expense.aggregate({ _sum: { amount: true }, where: { date: { gte: inicioMes } } }),
    prisma.user.count({ where: { role: 'USER' } }),
    prisma.payment.findMany({
      orderBy: { paidAt: 'desc' },
      distinct: ['userId'],
      select: { validUntil: true },
    }),
  ]);

  // Ocupación media por franja "día + hora" en las últimas 4 semanas
  const franjas = new Map<string, { plazas: number; ocupadas: number; esperas: number }>();
  let tardiasSemana = 0;
  const proximas: string[] = [];

  for (const c of clases) {
    const confirmadas = c.bookings.filter((b) => b.status === 'CONFIRMED').length;
    const esperas = c.bookings.filter((b) => b.status === 'WAITLISTED').length;
    const hora = c.date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Madrid' });
    // Hora de España (en Vercel el servidor va en UTC)
    const dia = c.date.toLocaleDateString('es-ES', { weekday: 'long', timeZone: 'Europe/Madrid' });

    if (c.date <= ahora) {
      const clave = `${dia} ${hora}`;
      const f = franjas.get(clave) ?? { plazas: 0, ocupadas: 0, esperas: 0 };
      f.plazas += c.capacity;
      f.ocupadas += confirmadas;
      f.esperas += esperas;
      franjas.set(clave, f);
      if (c.date >= hace7) {
        tardiasSemana += c.bookings.filter((b) => b.status === 'CANCELLED_LATE').length;
      }
    } else {
      proximas.push(`${dia} ${hora}: ${confirmadas}/${c.capacity}${esperas ? ` (+${esperas} en espera)` : ''}`);
    }
  }

  const ocupacionFranjas = Array.from(franjas.entries())
    .map(([k, f]) => `${k}: ${Math.round((f.ocupadas / f.plazas) * 100)}%${f.esperas ? `, ${f.esperas} veces lista de espera` : ''}`)
    .join('\n');

  const vencidas = pagos.filter((p) => p.validUntil < ahora).length;

  return `Socios totales: ${socios}
Cuotas vencidas: ${vencidas}
Ingresos este mes: ${ingresos._sum.amount ?? 0} €
Gastos este mes: ${gastos._sum.amount ?? 0} €
Cancelaciones tardías en los últimos 7 días: ${tardiasSemana}

Ocupación media por franja (últimas 4 semanas):
${ocupacionFranjas || 'sin datos'}

Próximos 7 días (confirmados/aforo):
${proximas.join('\n') || 'no hay clases programadas'}`;
}

export async function generarResumenSemanal(): Promise<ResumenIA> {
  const datos = await datosSemana();

  return generarJSON({
    system: SYSTEM_ADMIN,
    nombre: 'guardar_resumen',
    descripcion: 'Guarda el resumen semanal del gimnasio',
    maxTokens: 1500,
    zodSchema: resumenZod,
    jsonSchema: {
      type: 'object',
      properties: {
        titular: { type: 'string', description: 'Una frase que resuma cómo va el gimnasio' },
        puntos: {
          type: 'array',
          description: '3-6 observaciones basadas en los datos',
          items: {
            type: 'object',
            properties: {
              tipo: { type: 'string', enum: ['bien', 'atencion', 'idea'] },
              texto: { type: 'string' },
            },
            required: ['tipo', 'texto'],
          },
        },
        acciones: {
          type: 'array',
          items: { type: 'string' },
          description: '2-4 acciones concretas para esta semana (ej: mover una franja floja, abrir otra clase donde hay lista de espera)',
        },
      },
      required: ['titular', 'puntos', 'acciones'],
    },
    prompt: `Estos son los datos reales del gimnasio. Analízalos y dime qué está pasando y qué haría esta semana.
No inventes datos que no estén aquí.

${datos}`,
  });
}
