import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import {
  inicioDeSemana,
  finDeSemana,
  LIMITE_POR_PLAN,
  promocionarSiguienteEnEspera,
} from '@/lib/booking-logic';
import { estaVencido } from '@/lib/payment-logic';

const cambiarReservaSchema = z.object({
  nuevaClassSessionId: z.string(),
});

// PATCH /api/bookings/[id]/move -> mueve una reserva CONFIRMED a otra clase.
//
// Es una operación atómica: solo si el nuevo día tiene hueco libre (y
// cumple aforo/tarifa/pago) se confirma el cambio. Si algo falla, la
// reserva original NO se toca, así el usuario nunca se queda sin
// clase por el camino (que es justo lo que pasa hoy con cancelar +
// volver a reservar por separado).
//
// La reserva antigua se marca como CANCELLED_ON_TIME (libera el hueco y
// NO consume el día de la tarifa semanal), sea cual sea la hora a la que
// se haga el cambio: si el cambio se completa, el usuario no ha perdido
// ninguna clase, solo la ha movido de día.
export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const userId = (session.user as any).id;

  try {
    const body = await request.json();
    const { nuevaClassSessionId } = cambiarReservaSchema.parse(body);

    const reserva = await prisma.booking.findUnique({
      where: { id: params.id },
      include: { classSession: true },
    });

    if (!reserva) {
      return NextResponse.json({ error: 'Reserva no encontrada' }, { status: 404 });
    }
    if (reserva.userId !== userId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }
    if (reserva.status !== 'CONFIRMED') {
      return NextResponse.json(
        { error: 'Solo se puede cambiar de día una reserva confirmada' },
        { status: 409 }
      );
    }
    if (reserva.classSessionId === nuevaClassSessionId) {
      return NextResponse.json(
        { error: 'Ya tienes tu reserva en ese día' },
        { status: 409 }
      );
    }

    const nuevaClase = await prisma.classSession.findUnique({
      where: { id: nuevaClassSessionId },
      include: { _count: { select: { bookings: { where: { status: 'CONFIRMED' } } } } },
    });

    if (!nuevaClase) {
      return NextResponse.json({ error: 'La clase no existe' }, { status: 404 });
    }
    if (nuevaClase.cancelled) {
      return NextResponse.json({ error: 'Esa clase ha sido cancelada' }, { status: 409 });
    }
    if (nuevaClase.date.getTime() <= Date.now()) {
      return NextResponse.json({ error: 'Esa clase ya ha pasado' }, { status: 409 });
    }

    // No permitimos moverse a un día donde ya tengas algo (confirmado o en espera)
    const reservaEnDestino = await prisma.booking.findUnique({
      where: { userId_classSessionId: { userId, classSessionId: nuevaClassSessionId } },
    });
    if (reservaEnDestino?.status === 'CONFIRMED') {
      return NextResponse.json({ error: 'Ya estás apuntado a esa clase' }, { status: 409 });
    }
    if (reservaEnDestino?.status === 'WAITLISTED') {
      return NextResponse.json(
        { error: 'Ya estás en la lista de espera de esa clase' },
        { status: 409 }
      );
    }

    // Sin pagos online: si el usuario tiene el pago vencido, no puede
    // mover reservas igual que no puede crear reservas nuevas.
    const ultimoPago = await prisma.payment.findFirst({
      where: { userId },
      orderBy: { paidAt: 'desc' },
    });
    if (!ultimoPago || estaVencido(ultimoPago.validUntil)) {
      return NextResponse.json(
        { error: 'Tu pago está vencido o no consta ningún pago. Contacta con el gimnasio para renovarlo.' },
        { status: 403 }
      );
    }

    const usuario = await prisma.user.findUnique({ where: { id: userId } });
    if (!usuario) {
      return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 });
    }
    if (usuario.cancellationRequested) {
      return NextResponse.json(
        { error: 'Has solicitado la baja, así que no puedes mover reservas.' },
        { status: 403 }
      );
    }

    // Decisión de negocio: si no hay hueco libre en el día destino, se
    // bloquea el cambio (sin lista de espera automática) para no dejar la
    // reserva antigua en un estado incierto.
    if (nuevaClase._count.bookings >= nuevaClase.capacity) {
      return NextResponse.json(
        { error: 'Ese día no tiene hueco libre. Elige otro día.' },
        { status: 409 }
      );
    }

    // Límite semanal según la tarifa, en la semana del día DESTINO. Si la
    // reserva actual cae en esa misma semana, no debe contarse dos veces:
    // se libera como parte de este mismo cambio.
    const inicioSemanaDestino = inicioDeSemana(nuevaClase.date);
    const finSemanaDestino = finDeSemana(nuevaClase.date);

    let usadasEstaSemana = await prisma.booking.count({
      where: {
        userId,
        status: { in: ['CONFIRMED', 'CANCELLED_LATE'] },
        classSession: { date: { gte: inicioSemanaDestino, lt: finSemanaDestino } },
      },
    });

    const reservaActualEnMismaSemana =
      reserva.classSession.date >= inicioSemanaDestino && reserva.classSession.date < finSemanaDestino;
    if (reservaActualEnMismaSemana) {
      usadasEstaSemana -= 1;
    }

    const limite = LIMITE_POR_PLAN[usuario.weeklyPlan];
    if (usadasEstaSemana >= limite) {
      return NextResponse.json(
        { error: `Ya has usado tus ${limite} día(s) de esa semana según tu tarifa` },
        { status: 409 }
      );
    }

    // Todo validado: hacemos el cambio de forma atómica. Si la reserva de
    // destino ya existía cancelada (de una vez anterior), la reactivamos
    // en vez de crear un duplicado (restricción única userId+classSessionId).
    const [reservaAntiguaActualizada, reservaNueva] = await prisma.$transaction([
      prisma.booking.update({
        where: { id: reserva.id },
        data: { status: 'CANCELLED_ON_TIME', cancelledAt: new Date() },
      }),
      reservaEnDestino
        ? prisma.booking.update({
            where: { id: reservaEnDestino.id },
            data: { status: 'CONFIRMED', cancelledAt: null },
          })
        : prisma.booking.create({
            data: { userId, classSessionId: nuevaClassSessionId, status: 'CONFIRMED' },
          }),
    ]);

    // El hueco antiguo se ha liberado: si había alguien en espera para esa
    // clase, le toca entrar.
    await promocionarSiguienteEnEspera(reserva.classSessionId, reserva.classSession.date);

    return NextResponse.json({
      reservaAnterior: reservaAntiguaActualizada,
      reservaNueva,
      aviso: 'Reserva cambiada de día correctamente. No se ha descontado ningún día de tu tarifa.',
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0].message }, { status: 400 });
    }
    console.error('Error cambiando reserva:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
