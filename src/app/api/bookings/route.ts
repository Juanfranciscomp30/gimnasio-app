import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { inicioDeSemana, finDeSemana, LIMITE_POR_PLAN } from '@/lib/booking-logic';
import { estaVencido } from '@/lib/payment-logic';

const crearReservaSchema = z.object({
  classSessionId: z.string(),
});

// Devuelve las reservas del usuario logueado (para pintar "Mis clases")
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const reservas = await prisma.booking.findMany({
    where: { userId: (session.user as any).id },
    include: { classSession: true },
  });

  return NextResponse.json(reservas);
}

// Crea una reserva nueva, validando aforo y límite semanal según la tarifa
export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const userId = (session.user as any).id;

  try {
    const body = await request.json();
    const { classSessionId } = crearReservaSchema.parse(body);

    const clase = await prisma.classSession.findUnique({
      where: { id: classSessionId },
      include: { _count: { select: { bookings: { where: { status: 'CONFIRMED' } } } } },
    });

    if (!clase) {
      return NextResponse.json({ error: 'La clase no existe' }, { status: 404 });
    }

    // 1. Comprobar aforo disponible
    if (clase._count.bookings >= clase.capacity) {
      return NextResponse.json({ error: 'Esta clase ya está completa' }, { status: 409 });
    }

    // 2. Comprobar que no esté ya apuntado a esta misma clase
    const reservaExistente = await prisma.booking.findUnique({
      where: { userId_classSessionId: { userId, classSessionId } },
    });
    if (reservaExistente && reservaExistente.status === 'CONFIRMED') {
      return NextResponse.json({ error: 'Ya estás apuntado a esta clase' }, { status: 409 });
    }

    // 3. Comprobar que el usuario tiene el pago al día. Sin esto, alguien
    // podría seguir reservando clases indefinidamente sin haber pagado nunca.
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

    // 4. Comprobar el límite semanal según la tarifa del usuario
    const usuario = await prisma.user.findUnique({ where: { id: userId } });
    if (!usuario) {
      return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 });
    }

    // Si ha solicitado la baja, no puede apuntarse a clases nuevas (pero
    // conserva las reservas que ya tuviera hechas hasta que el admin la confirme)
    if (usuario.cancellationRequested) {
      return NextResponse.json(
        { error: 'Has solicitado la baja, así que no puedes reservar nuevas clases.' },
        { status: 403 }
      );
    }

    const inicio = inicioDeSemana(clase.date);
    const fin = finDeSemana(clase.date);

    // Contamos reservas CONFIRMED o CANCELLED_LATE (ambas "consumen" un día
    // de la tarifa semanal) de clases que caen en esa misma semana
    const usadasEstaSemana = await prisma.booking.count({
      where: {
        userId,
        status: { in: ['CONFIRMED', 'CANCELLED_LATE'] },
        classSession: { date: { gte: inicio, lt: fin } },
      },
    });

    const limite = LIMITE_POR_PLAN[usuario.weeklyPlan];
    if (usadasEstaSemana >= limite) {
      return NextResponse.json(
        { error: `Ya has usado tus ${limite} día(s) de esta semana según tu tarifa` },
        { status: 409 }
      );
    }

    // Si ya existía una reserva cancelada a tiempo para esta clase, la
    // reactivamos en vez de crear un duplicado (evita chocar con la
    // restricción única userId+classSessionId)
    const reserva = reservaExistente
      ? await prisma.booking.update({
          where: { id: reservaExistente.id },
          data: { status: 'CONFIRMED', cancelledAt: null },
        })
      : await prisma.booking.create({
          data: { userId, classSessionId, status: 'CONFIRMED' },
        });

    return NextResponse.json(reserva, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0].message }, { status: 400 });
    }
    console.error('Error creando reserva:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}