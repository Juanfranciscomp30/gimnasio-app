import { NextResponse } from 'next/server';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/tablas';

const crearEjercicioSchema = z.object({
  name: z.string().trim().min(1, 'Escribe el nombre del ejercicio').max(80),
  muscleGroup: z.string().trim().max(40).optional(),
  notes: z.string().trim().max(300).optional(),
});

// Catálogo de ejercicios, ordenado por nombre. Incluye en cuántas tablas
// sale cada uno, para que el admin sepa si puede borrarlo.
export async function GET() {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  const ejercicios = await prisma.exercise.findMany({
    orderBy: { name: 'asc' },
    include: { _count: { select: { routineExercises: true, setLogs: true } } },
  });

  return NextResponse.json(ejercicios);
}

export async function POST(request: Request) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  try {
    const datos = crearEjercicioSchema.parse(await request.json());
    const ejercicio = await prisma.exercise.create({
      data: {
        name: datos.name,
        muscleGroup: datos.muscleGroup || null,
        notes: datos.notes || null,
      },
    });
    return NextResponse.json(ejercicio, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0].message }, { status: 400 });
    }
    // P2002 = violación de @unique: ya hay un ejercicio con ese nombre
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return NextResponse.json({ error: 'Ya existe un ejercicio con ese nombre' }, { status: 409 });
    }
    console.error('Error creando ejercicio:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
