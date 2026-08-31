import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { generarFechasRecurrentes } from '@/lib/booking-logic';

const claseUnicaSchema = z.object({
  recurring: z.literal(false).optional(),
  date: z.string().datetime(),
  capacity: z.number().int().positive(),
});

const claseRecurrenteSchema = z
  .object({
    recurring: z.literal(true),
    daysOfWeek: z.array(z.number().int().min(0).max(6)).min(1, 'Selecciona al menos un día'),
    time: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Hora inválida'),
    capacity: z.number().int().positive(),
    startDate: z.string(), // "YYYY-MM-DD"
    endMode: z.enum(['date', 'weeks']),
    endDate: z.string().optional(),
    weeks: z.number().int().positive().max(52).optional(),
  })
  .refine((d) => (d.endMode === 'date' ? !!d.endDate : !!d.weeks), {
    message: 'Falta la fecha final o el número de semanas',
  });

const crearClaseSchema = z.union([claseRecurrenteSchema, claseUnicaSchema]);

// Cualquiera logueado puede LEER las clases.
// ?when=upcoming -> solo futuras | ?when=past -> solo pasadas | sin parámetro -> todas
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const when = searchParams.get('when');

  const ahora = new Date();
  const filtroFecha =
    when === 'upcoming' ? { gte: ahora } : when === 'past' ? { lt: ahora } : undefined;

  const clases = await prisma.classSession.findMany({
    where: filtroFecha ? { date: filtroFecha } : undefined,
    orderBy: { date: when === 'past' ? 'desc' : 'asc' },
    include: {
      _count: {
        select: { bookings: { where: { status: 'CONFIRMED' } } },
      },
    },
  });

  return NextResponse.json(clases);
}

// Solo el ADMIN puede CREAR clases (única o recurrente)
export async function POST(request: Request) {
  const session = await getServerSession(authOptions);

  if (!session || (session.user as any).role !== 'ADMIN') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const datos = crearClaseSchema.parse(body);

    // --- Creación recurrente ---
    if (datos.recurring) {
      const inicio = new Date(datos.startDate);
      const fin =
        datos.endMode === 'date'
          ? new Date(datos.endDate as string)
          : (() => {
              const f = new Date(inicio);
              f.setDate(f.getDate() + (datos.weeks as number) * 7);
              return f;
            })();

      if (fin < inicio) {
        return NextResponse.json(
          { error: 'La fecha final no puede ser anterior a la de inicio' },
          { status: 400 }
        );
      }

      const fechas = generarFechasRecurrentes({
        startDate: inicio,
        daysOfWeek: datos.daysOfWeek,
        time: datos.time,
        endDate: fin,
      });

      if (fechas.length === 0) {
        return NextResponse.json(
          { error: 'No se ha generado ninguna clase con esos criterios' },
          { status: 400 }
        );
      }

      const { count } = await prisma.classSession.createMany({
        data: fechas.map((date) => ({ date, capacity: datos.capacity })),
      });

      return NextResponse.json({ creadas: count }, { status: 201 });
    }

    // --- Creación única (comportamiento original, intacto) ---
    const nuevaClase = await prisma.classSession.create({
      data: {
        date: new Date(datos.date),
        capacity: datos.capacity,
      },
    });

    return NextResponse.json(nuevaClase, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0].message }, { status: 400 });
    }
    console.error('Error creando clase:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}