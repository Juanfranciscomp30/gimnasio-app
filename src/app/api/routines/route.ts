import { NextResponse } from 'next/server';
import { z } from 'zod';
import { Prisma, WeeklyPlan } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { DIAS_POR_PLAN, INCLUDE_TABLA, leerMes, requireAdmin } from '@/lib/tablas';

const crearTablaSchema = z.object({
  year: z.number().int().min(2000).max(2100),
  month: z.number().int().min(1).max(12),
  weeklyPlan: z.nativeEnum(WeeklyPlan),
  title: z.string().trim().max(80).optional(),
  // Si viene, se copian los días y ejercicios de esa tabla (normalmente la
  // del mes anterior) para no tener que montarla desde cero.
  copyFromId: z.string().optional(),
});

// Tablas de un mes (?year=2026&month=11): una como mucho por tarifa.
export async function GET(request: Request) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  const mes = leerMes(request.url);
  if (!mes) {
    return NextResponse.json({ error: 'Mes no válido' }, { status: 400 });
  }

  const tablas = await prisma.routine.findMany({
    where: { year: mes.year, month: mes.month },
    include: INCLUDE_TABLA,
  });

  return NextResponse.json(tablas);
}

// Crea la tabla de un mes para una tarifa, con tantos días como permite la
// tarifa (1, 2 o 3). Vacía o copiada de otra tabla.
export async function POST(request: Request) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  try {
    const datos = crearTablaSchema.parse(await request.json());
    const numDias = DIAS_POR_PLAN[datos.weeklyPlan];

    const origen = datos.copyFromId
      ? await prisma.routine.findUnique({ where: { id: datos.copyFromId }, include: INCLUDE_TABLA })
      : null;
    if (datos.copyFromId && !origen) {
      return NextResponse.json({ error: 'La tabla a copiar no existe' }, { status: 404 });
    }

    const tabla = await prisma.routine.create({
      data: {
        year: datos.year,
        month: datos.month,
        weeklyPlan: datos.weeklyPlan,
        title: datos.title || origen?.title || null,
        notes: origen?.notes ?? null,
        days: {
          create: Array.from({ length: numDias }, (_, i) => {
            const dayNumber = i + 1;
            const diaOrigen = origen?.days.find((d) => d.dayNumber === dayNumber);
            return {
              dayNumber,
              name: diaOrigen?.name ?? null,
              exercises: {
                create: (diaOrigen?.exercises ?? []).map((e) => ({
                  exerciseId: e.exerciseId,
                  order: e.order,
                  sets: e.sets,
                  reps: e.reps,
                  restSeconds: e.restSeconds,
                  notes: e.notes,
                })),
              },
            };
          }),
        },
      },
      include: INCLUDE_TABLA,
    });

    return NextResponse.json(tabla, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0].message }, { status: 400 });
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return NextResponse.json(
        { error: 'Ya existe una tabla para esa tarifa en ese mes' },
        { status: 409 }
      );
    }
    console.error('Error creando tabla:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
