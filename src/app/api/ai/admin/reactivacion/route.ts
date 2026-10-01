import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { detectarCandidatosReactivacion, redactarMensajesReactivacion } from '@/lib/ai/admin';
import { IaNoConfiguradaError, iaDisponible } from '@/lib/ai/client';

// Tope de redacciones con IA por día. En la demo pública cualquiera puede
// entrar como admin, así que esto protege la factura de la API.
const MAX_REDACCIONES_DIA = Number(process.env.AI_ADMIN_DAILY_LIMIT ?? 20);

async function requireAdmin() {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any).role !== 'ADMIN') return null;
  return session;
}

// GET → lista de socios que conviene "reactivar" y por qué (sin IA)
export async function GET() {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }
  const candidatos = await detectarCandidatosReactivacion();
  return NextResponse.json({ candidatos, iaDisponible: iaDisponible() });
}

const bodySchema = z.discriminatedUnion('accion', [
  // La IA redacta un borrador por socio (el admin lo revisa antes de enviar)
  z.object({ accion: z.literal('redactar'), userIds: z.array(z.string()).min(1).max(20) }),
  // El admin envía los mensajes (ya revisados/editados) como avisos in-app
  z.object({
    accion: z.literal('enviar'),
    mensajes: z
      .array(z.object({ userId: z.string(), mensaje: z.string().trim().min(1).max(500) }))
      .min(1)
      .max(20),
  }),
]);

export async function POST(request: Request) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Petición no válida' }, { status: 400 });
  }
  const body = parsed.data;

  if (body.accion === 'enviar') {
    // Cada socio recibe SU mensaje, así que no usamos crearNotificaciones
    // (que manda el mismo texto a todos) sino createMany con cada uno.
    const { count } = await prisma.notification.createMany({
      data: body.mensajes.map((m) => ({ userId: m.userId, message: m.mensaje })),
    });
    return NextResponse.json({ enviados: count });
  }

  // accion === 'redactar': recalculamos candidatos en el servidor para no
  // fiarnos de lo que mande el navegador y quedarnos solo con los pedidos.
  const pedidos = new Set(body.userIds);
  const candidatos = (await detectarCandidatosReactivacion()).filter((c) => pedidos.has(c.userId));
  if (candidatos.length === 0) {
    return NextResponse.json({ mensajes: [] });
  }

  const redaccionesHoy = await prisma.aiReport.count({
    where: { kind: 'REACTIVACION', createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
  });
  if (redaccionesHoy >= MAX_REDACCIONES_DIA) {
    return NextResponse.json(
      { error: 'Se ha alcanzado el límite diario de redacciones con IA. Vuelve a intentarlo mañana.' },
      { status: 429 }
    );
  }

  try {
    const mensajes = await redactarMensajesReactivacion(candidatos);
    // Guardamos cada redacción: sirve de historial y para contar el tope diario
    await prisma.aiReport.create({
      data: { kind: 'REACTIVACION', content: { mensajes } },
    });
    return NextResponse.json({ mensajes });
  } catch (error) {
    if (error instanceof IaNoConfiguradaError) {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }
    console.error('Error redactando mensajes IA:', error);
    return NextResponse.json({ error: 'La IA no ha podido redactar los mensajes. Prueba de nuevo.' }, { status: 502 });
  }
}
