import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { estaVencido, venceProto } from '@/lib/payment-logic';

async function requireAdmin() {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any).role !== 'ADMIN') return null;
  return session;
}

// Resumen para el panel de inicio del admin: ingresos del mes, estado de
// las cuotas de todos los usuarios, bajas pendientes y clases de hoy.
export async function GET() {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  const ahora = new Date();
  const inicioMes = new Date(ahora.getFullYear(), ahora.getMonth(), 1);
  const inicioMesSiguiente = new Date(ahora.getFullYear(), ahora.getMonth() + 1, 1);
  const inicioHoy = new Date(ahora);
  inicioHoy.setHours(0, 0, 0, 0);
  const finHoy = new Date(inicioHoy);
  finHoy.setDate(finHoy.getDate() + 1);

  const [ingresosMes, usuarios, pagos, bajasPendientes, clasesHoy, totalUsuarios] =
    await Promise.all([
      prisma.payment.aggregate({
        _sum: { amount: true },
        where: { paidAt: { gte: inicioMes, lt: inicioMesSiguiente } },
      }),
      prisma.user.findMany({
        where: { role: 'USER' },
        select: { id: true, name: true },
      }),
      prisma.payment.findMany({
        select: { userId: true, validUntil: true, paidAt: true },
        orderBy: { paidAt: 'desc' },
      }),
      prisma.user.findMany({
        where: { role: 'USER', cancellationRequested: true },
        select: { id: true, name: true },
        orderBy: { cancellationRequestedAt: 'asc' },
      }),
      prisma.classSession.findMany({
        where: { date: { gte: inicioHoy, lt: finHoy }, cancelled: false },
        include: { _count: { select: { bookings: { where: { status: 'CONFIRMED' } } } } },
        orderBy: { date: 'asc' },
      }),
      prisma.user.count({ where: { role: 'USER' } }),
    ]);

  // Último pago de cada usuario (los pagos ya vienen ordenados por fecha desc)
  const ultimoPagoPorUsuario = new Map<string, (typeof pagos)[number]>();
  for (const pago of pagos) {
    if (!ultimoPagoPorUsuario.has(pago.userId)) {
      ultimoPagoPorUsuario.set(pago.userId, pago);
    }
  }

  let vencidas = 0;
  let porVencer = 0;
  let sinPagos = 0;

  for (const usuario of usuarios) {
    const ultimoPago = ultimoPagoPorUsuario.get(usuario.id);
    if (!ultimoPago) {
      sinPagos++;
    } else if (estaVencido(ultimoPago.validUntil, ahora)) {
      vencidas++;
    } else if (venceProto(ultimoPago.validUntil, ahora)) {
      porVencer++;
    }
  }

  return NextResponse.json({
    ingresosMes: ingresosMes._sum.amount ?? 0,
    totalUsuarios,
    cuotas: { vencidas, porVencer, sinPagos },
    bajasPendientes: bajasPendientes.map((u) => ({ id: u.id, nombre: u.name })),
    clasesHoy: clasesHoy.map((c) => ({
      id: c.id,
      date: c.date,
      capacity: c.capacity,
      confirmados: c._count.bookings,
    })),
  });
}
