import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getServerSession } from 'next-auth';
import { AiPlanKind, Prisma } from '@prisma/client';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { inicioDeSemana } from '@/lib/booking-logic';
import { contextoSocio } from '@/lib/ai/contexto';
import { generarPlanEntreno, generarPlanNutricion } from '@/lib/ai/coach';
import { IaNoConfiguradaError, iaDisponible } from '@/lib/ai/client';
import { MAX_GENERACIONES_SEMANA } from '@/lib/ai/opciones';

const kindSchema = z.nativeEnum(AiPlanKind);

async function generacionesEstaSemana(userId: string, kind: AiPlanKind) {
  return prisma.aiPlan.count({
    where: { userId, kind, createdAt: { gte: inicioDeSemana(new Date()) } },
  });
}

// GET /api/ai/plan?kind=TRAINING|NUTRITION
// Devuelve el último plan de ese tipo y cuántas generaciones le quedan.
export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const parsed = kindSchema.safeParse(new URL(request.url).searchParams.get('kind'));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Tipo de plan no válido' }, { status: 400 });
  }
  const kind = parsed.data;
  const userId = (session.user as any).id;

  const [plan, usadas, perfil] = await Promise.all([
    prisma.aiPlan.findFirst({ where: { userId, kind }, orderBy: { createdAt: 'desc' } }),
    generacionesEstaSemana(userId, kind),
    prisma.fitnessProfile.findUnique({ where: { userId }, select: { id: true } }),
  ]);

  return NextResponse.json({
    plan,
    restantes: Math.max(0, MAX_GENERACIONES_SEMANA - usadas),
    tienePerfil: !!perfil,
    iaDisponible: iaDisponible(),
  });
}

// POST /api/ai/plan  { kind }  → genera un plan nuevo con la IA
export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const parsed = z.object({ kind: kindSchema }).safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Tipo de plan no válido' }, { status: 400 });
  }
  const { kind } = parsed.data;
  const userId = (session.user as any).id;

  // Límite semanal: protege la factura de la API
  if ((await generacionesEstaSemana(userId, kind)) >= MAX_GENERACIONES_SEMANA) {
    return NextResponse.json(
      { error: `Ya has generado ${MAX_GENERACIONES_SEMANA} planes esta semana. El lunes podrás pedir otro.` },
      { status: 429 }
    );
  }

  const contexto = await contextoSocio(userId);
  if (!contexto) {
    return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 });
  }

  try {
    const content =
      kind === 'TRAINING'
        ? await generarPlanEntreno(contexto.texto, contexto.diasSemana)
        : await generarPlanNutricion(contexto.texto);

    const plan = await prisma.aiPlan.create({
      data: { userId, kind, content: content as Prisma.InputJsonValue },
    });

    return NextResponse.json(plan, { status: 201 });
  } catch (error) {
    if (error instanceof IaNoConfiguradaError) {
      return NextResponse.json({ error: 'El asistente IA aún no está activado en el gimnasio' }, { status: 503 });
    }
    console.error('Error generando plan IA:', error);
    return NextResponse.json(
      { error: 'No se ha podido generar el plan ahora mismo. Inténtalo en un rato.' },
      { status: 502 }
    );
  }
}
