import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { crearNotificaciones } from '@/lib/notifications';

// Detalle de una clase concreta: quién se apuntó y con qué estado.
// Solo ADMIN — se usa en el historial y en la gestión rápida de clases.
export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);

  if (!session || (session.user as any).role !== 'ADMIN') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  const clase = await prisma.classSession.findUnique({
    where: { id: params.id },
    include: {
      bookings: {
        include: {
          user: { select: { id: true, name: true, email: true, profileImageUrl: true } },
        },
        orderBy: { createdAt: 'asc' },
      },
    },
  });

  if (!clase) {
    return NextResponse.json({ error: 'Clase no encontrada' }, { status: 404 });
  }

  // El admin de clases necesita estos dos campos (igual que el listado de
  // GET /api/classes) para poder editar el aforo con el mínimo correcto.
  const confirmados = clase.bookings.filter((b) => b.status === 'CONFIRMED').length;
  const enEspera = clase.bookings.filter((b) => b.status === 'WAITLISTED').length;

  return NextResponse.json({
    ...clase,
    _count: { bookings: confirmados },
    enEspera,
  });
}

const editarClaseSchema = z.object({
  capacity: z.number().int().positive().optional(),
  date: z.string().datetime().optional(),
  accion: z.literal('cancelar').optional(),
});

async function requireAdmin() {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any).role !== 'ADMIN') return null;
  return session;
}

function formatoFechaHora(fecha: Date) {
  return fecha.toLocaleString('es-ES', {
    weekday: 'long',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// Editar aforo/hora de una clase, o cancelarla del todo (accion: 'cancelar').
export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  const clase = await prisma.classSession.findUnique({
    where: { id: params.id },
    include: {
      _count: { select: { bookings: { where: { status: 'CONFIRMED' } } } },
      // Todo el mundo que tiene algo que perder si esta clase cambia:
      // confirmados (se les mueve la hora) y en espera (puede que ya no
      // les venga bien el nuevo horario).
      bookings: {
        where: { status: { in: ['CONFIRMED', 'WAITLISTED'] } },
        select: { userId: true },
      },
    },
  });
  if (!clase) {
    return NextResponse.json({ error: 'Clase no encontrada' }, { status: 404 });
  }

  const idsAAvisar = [...new Set(clase.bookings.map((b) => b.userId))];

  try {
    const body = await request.json();
    const datos = editarClaseSchema.parse(body);

    // --- Cancelar la clase entera ---
    if (datos.accion === 'cancelar') {
      if (clase.cancelled) {
        return NextResponse.json({ error: 'Esta clase ya está cancelada' }, { status: 409 });
      }

      await prisma.$transaction([
        // A quien tuviera la plaza confirmada no le penalizamos: se libera
        // como si hubiera cancelado a tiempo, no pierde el día de su tarifa.
        prisma.booking.updateMany({
          where: { classSessionId: clase.id, status: 'CONFIRMED' },
          data: { status: 'CANCELLED_ON_TIME', cancelledAt: new Date() },
        }),
        // La lista de espera no llegó a confirmarse, así que simplemente se borra.
        prisma.booking.deleteMany({
          where: { classSessionId: clase.id, status: 'WAITLISTED' },
        }),
        prisma.classSession.update({
          where: { id: clase.id },
          data: { cancelled: true },
        }),
      ]);

      await crearNotificaciones(
        idsAAvisar,
        `Tu clase del ${formatoFechaHora(clase.date)} ha sido cancelada por el gimnasio. No se te penaliza el día.`
      );

      return NextResponse.json({ ok: true });
    }

    // --- Editar aforo y/o fecha ---
    if (clase.cancelled) {
      return NextResponse.json(
        { error: 'No se puede editar una clase cancelada' },
        { status: 409 }
      );
    }

    if (datos.capacity !== undefined && datos.capacity < clase._count.bookings) {
      return NextResponse.json(
        {
          error: `Ya hay ${clase._count.bookings} personas confirmadas: el aforo no puede ser menor`,
        },
        { status: 409 }
      );
    }

    const fechaAnterior = clase.date;
    const fechaNueva = datos.date !== undefined ? new Date(datos.date) : null;
    const cambiaHorario = fechaNueva !== null && fechaNueva.getTime() !== fechaAnterior.getTime();

    const claseActualizada = await prisma.classSession.update({
      where: { id: clase.id },
      data: {
        ...(datos.capacity !== undefined ? { capacity: datos.capacity } : {}),
        ...(fechaNueva !== null ? { date: fechaNueva } : {}),
      },
    });

    // Solo avisamos si de verdad cambia el día/hora: un simple cambio de
    // aforo no afecta a quien ya tiene su plaza, así que no le interrumpimos.
    if (cambiaHorario) {
      await crearNotificaciones(
        idsAAvisar,
        `Tu clase del ${formatoFechaHora(fechaAnterior)} ha cambiado de horario. Ahora es el ${formatoFechaHora(fechaNueva!)}.`
      );
    }

    return NextResponse.json(claseActualizada);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0].message }, { status: 400 });
    }
    console.error('Error editando clase:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
