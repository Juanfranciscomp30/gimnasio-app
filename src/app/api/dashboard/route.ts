import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { inicioDeSemana, finDeSemana, LIMITE_POR_PLAN } from '@/lib/booking-logic';
import { estaVencido, venceProto } from '@/lib/payment-logic';

// Resumen para el panel principal del usuario (/inicio): próxima(s)
// clase(s), uso de su tarifa esta semana, y estado de la membresía.
// Todo en una sola llamada para no encadenar varios fetch en el cliente.
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const userId = (session.user as any).id;
  const ahora = new Date();

  const usuario = await prisma.user.findUnique({ where: { id: userId } });
  if (!usuario) {
    return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 });
  }

  // Próximas clases confirmadas (la primera es "la próxima clase")
  const proximasReservas = await prisma.booking.findMany({
    where: {
      userId,
      status: 'CONFIRMED',
      classSession: { date: { gte: ahora } },
    },
    include: { classSession: true },
    orderBy: { classSession: { date: 'asc' } },
    take: 3,
  });

  // Uso de la tarifa semanal (misma cuenta que en POST /api/bookings)
  const inicioSemana = inicioDeSemana(ahora);
  const finSemana = finDeSemana(ahora);
  const usadasEstaSemana = await prisma.booking.count({
    where: {
      userId,
      status: { in: ['CONFIRMED', 'CANCELLED_LATE'] },
      classSession: { date: { gte: inicioSemana, lt: finSemana } },
    },
  });

  // Estado de la membresía según el último pago registrado
  const ultimoPago = await prisma.payment.findFirst({
    where: { userId },
    orderBy: { paidAt: 'desc' },
  });

  const pago = ultimoPago
    ? {
        validUntil: ultimoPago.validUntil,
        vencido: estaVencido(ultimoPago.validUntil, ahora),
        venceProto: venceProto(ultimoPago.validUntil, ahora),
      }
    : null;

  return NextResponse.json({
    nombre: usuario.name,
    weeklyPlan: usuario.weeklyPlan,
    cancellationRequested: usuario.cancellationRequested,
    proximasClases: proximasReservas.map((r) => ({
      bookingId: r.id,
      classSessionId: r.classSessionId,
      date: r.classSession.date,
    })),
    usoSemanal: {
      usadas: usadasEstaSemana,
      limite: LIMITE_POR_PLAN[usuario.weeklyPlan],
    },
    pago,
  });
}
