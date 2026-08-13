import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { PRECIO_POR_PLAN, calcularValidoHasta } from '@/lib/payment-logic';

const registrarPagoSchema = z.object({
  userId: z.string(),
});

async function requireAdmin() {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any).role !== 'ADMIN') return null;
  return session;
}

// Lista todos los pagos, el más reciente primero
export async function GET() {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  const pagos = await prisma.payment.findMany({
    include: { user: { select: { id: true, name: true, email: true } } },
    orderBy: { paidAt: 'desc' },
  });

  return NextResponse.json(pagos);
}

// Registra un pago nuevo para un usuario. El importe y la fecha de
// vencimiento se calculan solos según la tarifa ACTUAL del usuario,
// el admin no tiene que escribir ningún número.
export async function POST(request: Request) {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { userId } = registrarPagoSchema.parse(body);

    const usuario = await prisma.user.findUnique({ where: { id: userId } });
    if (!usuario) {
      return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 });
    }

    const ahora = new Date();

    const pago = await prisma.payment.create({
      data: {
        userId,
        weeklyPlan: usuario.weeklyPlan,
        amount: PRECIO_POR_PLAN[usuario.weeklyPlan],
        paidAt: ahora,
        validUntil: calcularValidoHasta(ahora),
      },
    });

    return NextResponse.json(pago, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0].message }, { status: 400 });
    }
    console.error('Error registrando pago:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}