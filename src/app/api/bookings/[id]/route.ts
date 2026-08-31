import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { esCancelacionTardia, inicioDeSemana, finDeSemana, LIMITE_POR_PLAN } from '@/lib/booking-logic';
import { estaVencido } from '@/lib/payment-logic';

// PATCH /api/bookings/[id]  -> cancela esa reserva
export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const userId = (session.user as any).id;

  const reserva = await prisma.booking.findUnique({
    where: { id: params.id },
    include: { classSession: true },
  });

  if (!reserva) {
    return NextResponse.json({ error: 'Reserva no encontrada' }, { status: 404 });
  }

  // Un usuario solo puede cancelar SUS PROPIAS reservas
  if (reserva.userId !== userId) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  if (reserva.status !== 'CONFIRMED') {
    return NextResponse.json({ error: 'Esta reserva ya está cancelada' }, { status: 409 });
  }

  // Aquí está LA REGLA DE NEGOCIO clave: si quedan menos de 3h para la
  // clase, se marca como CANCELLED_LATE (pierde el día). Si no, CANCELLED_ON_TIME
  // (el hueco se libera y no consume su tarifa semanal).
  const tardia = esCancelacionTardia(reserva.classSession.date);

  const reservaActualizada = await prisma.booking.update({
    where: { id: reserva.id },
    data: {
      status: tardia ? 'CANCELLED_LATE' : 'CANCELLED_ON_TIME',
      cancelledAt: new Date(),
    },
  });

  await promocionarSiguienteEnEspera(reserva.classSessionId, reserva.classSession.date);

  return NextResponse.json({
    ...reservaActualizada,
    aviso: tardia
      ? 'Cancelada con menos de 3h de antelación: se ha descontado el día de tu tarifa.'
      : 'Cancelada correctamente, no se ha descontado ningún día.',
  });
}

// Se acaba de liberar un hueco en esta clase: si hay gente en lista de
// espera, promocionamos al primero (por orden de llegada) que sea
// elegible de verdad -> pago al día, sin baja pendiente, y que no haya
// agotado ya su límite semanal. Si el primero no es elegible, probamos
// con el siguiente, hasta encontrar uno o quedarnos sin candidatos.
async function promocionarSiguienteEnEspera(classSessionId: string, fechaClase: Date) {
  const enEspera = await prisma.booking.findMany({
    where: { classSessionId, status: 'WAITLISTED' },
    orderBy: { createdAt: 'asc' },
    take: 10,
  });

  const inicioSemana = inicioDeSemana(fechaClase);
  const finSemana = finDeSemana(fechaClase);

  for (const candidato of enEspera) {
    const usuario = await prisma.user.findUnique({ where: { id: candidato.userId } });
    if (!usuario || usuario.cancellationRequested) continue;

    const ultimoPago = await prisma.payment.findFirst({
      where: { userId: candidato.userId },
      orderBy: { paidAt: 'desc' },
    });
    if (!ultimoPago || estaVencido(ultimoPago.validUntil)) continue;

    const usadasEstaSemana = await prisma.booking.count({
      where: {
        userId: candidato.userId,
        status: { in: ['CONFIRMED', 'CANCELLED_LATE'] },
        classSession: { date: { gte: inicioSemana, lt: finSemana } },
      },
    });
    if (usadasEstaSemana >= LIMITE_POR_PLAN[usuario.weeklyPlan]) continue;

    await prisma.booking.update({
      where: { id: candidato.id },
      data: { status: 'CONFIRMED', cancelledAt: null },
    });
    return; // solo se ha liberado 1 plaza, promocionamos a un único candidato
  }
}

// Salir de la lista de espera (no es una cancelación real: nunca llegó a
// consumir ningún día, así que simplemente se borra la entrada)
export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const userId = (session.user as any).id;

  const reserva = await prisma.booking.findUnique({ where: { id: params.id } });

  if (!reserva || reserva.userId !== userId) {
    return NextResponse.json({ error: 'Reserva no encontrada' }, { status: 404 });
  }

  if (reserva.status !== 'WAITLISTED') {
    return NextResponse.json(
      { error: 'Esto solo se puede usar para salir de la lista de espera' },
      { status: 409 }
    );
  }

  await prisma.booking.delete({ where: { id: reserva.id } });

  return NextResponse.json({ ok: true });
}