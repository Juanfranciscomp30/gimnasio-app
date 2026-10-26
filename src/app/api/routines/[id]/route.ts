import { NextResponse } from 'next/server';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { DIAS_POR_PLAN, INCLUDE_TABLA, requireAdmin } from '@/lib/tablas';

const ejercicioTablaSchema = z.object({
  exerciseId: z.string().min(1),
  sets: z.number().int().min(1, 'Mínimo 1 serie').max(20),
  reps: z.string().trim().min(1, 'Indica las repeticiones').max(20),
  restSeconds: z.number().int().min(0).max(900).nullable().optional(),
  notes: z.string().trim().max(200).nullable().optional(),
});

const guardarTablaSchema = z.object({
  title: z.string().trim().max(80).nullable().optional(),
  notes: z.string().trim().max(500).nullable().optional(),
  days: z.array(
    z.object({
      dayNumber: z.number().int().min(1).max(3),
      name: z.string().trim().max(60).nullable().optional(),
      exercises: z.array(ejercicioTablaSchema).max(30),
    })
  ),
});

type EjercicioTabla = z.infer<typeof ejercicioTablaSchema>;

// El orden de la lista que manda el editor es el orden de la tabla
function filasEjercicios(ejercicios: EjercicioTabla[]) {
  return ejercicios.map((e, i) => ({
    exerciseId: e.exerciseId,
    order: i,
    sets: e.sets,
    reps: e.reps,
    restSeconds: e.restSeconds ?? null,
    notes: e.notes || null,
  }));
}

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  const tabla = await prisma.routine.findUnique({ where: { id: params.id }, include: INCLUDE_TABLA });
  if (!tabla) {
    return NextResponse.json({ error: 'Tabla no encontrada' }, { status: 404 });
  }
  return NextResponse.json(tabla);
}

// Guarda la tabla entera tal y como la tiene el editor: para cada día se
// borran sus ejercicios y se vuelven a crear en el orden recibido. Es más
// simple que calcular qué se ha movido/añadido/quitado, y como los pesos
// de los socios van ligados al ejercicio (no a esta fila) no se pierde nada.
export async function PUT(request: Request, { params }: { params: { id: string } }) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  try {
    const datos = guardarTablaSchema.parse(await request.json());

    const tabla = await prisma.routine.findUnique({ where: { id: params.id } });
    if (!tabla) {
      return NextResponse.json({ error: 'Tabla no encontrada' }, { status: 404 });
    }

    const numDias = DIAS_POR_PLAN[tabla.weeklyPlan];
    if (datos.days.some((d) => d.dayNumber > numDias)) {
      return NextResponse.json(
        { error: `Esta tarifa solo tiene ${numDias} día(s) de entrenamiento` },
        { status: 400 }
      );
    }

    // Todos los ejercicios tienen que existir en el catálogo
    const ids = Array.from(new Set(datos.days.flatMap((d) => d.exercises.map((e) => e.exerciseId))));
    const existentes = await prisma.exercise.count({ where: { id: { in: ids } } });
    if (existentes !== ids.length) {
      return NextResponse.json({ error: 'Algún ejercicio ya no existe en el catálogo' }, { status: 400 });
    }

    // Transacción "por lotes" (array de operaciones) en vez de interactiva:
    // va en un solo viaje a la base de datos, que con el pooler de Supabase
    // es más rápido y no tiene el límite de 5s de las interactivas. Los días
    // ya existen (se crean junto con la tabla), así que se pueden actualizar
    // por (routineId, dayNumber) sin tener que leer antes sus ids.
    const operaciones: Prisma.PrismaPromise<unknown>[] = [
      prisma.routine.update({
        where: { id: tabla.id },
        data: {
          title: datos.title === undefined ? undefined : datos.title || null,
          notes: datos.notes === undefined ? undefined : datos.notes || null,
        },
      }),
    ];

    for (const dia of datos.days) {
      const whereDia = { routineId: tabla.id, dayNumber: dia.dayNumber };
      operaciones.push(
        prisma.routineDay.upsert({
          where: { routineId_dayNumber: whereDia },
          update: {
            name: dia.name || null,
            // Reemplazamos todos los ejercicios del día por los recibidos
            exercises: {
              deleteMany: {},
              create: filasEjercicios(dia.exercises),
            },
          },
          create: {
            ...whereDia,
            name: dia.name || null,
            exercises: {
              create: filasEjercicios(dia.exercises),
            },
          },
        })
      );
    }

    await prisma.$transaction(operaciones);

    const actualizada = await prisma.routine.findUnique({
      where: { id: tabla.id },
      include: INCLUDE_TABLA,
    });
    return NextResponse.json(actualizada);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0].message }, { status: 400 });
    }
    console.error('Error guardando tabla:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

// Borra la tabla de un mes. Los pesos que apuntaron los socios se quedan
// (van ligados al ejercicio), así que su progreso no se pierde.
export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  const tabla = await prisma.routine.findUnique({ where: { id: params.id } });
  if (!tabla) {
    return NextResponse.json({ error: 'Tabla no encontrada' }, { status: 404 });
  }

  await prisma.routine.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
