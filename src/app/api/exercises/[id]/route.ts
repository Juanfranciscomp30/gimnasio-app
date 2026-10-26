import { NextResponse } from 'next/server';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/tablas';

const editarEjercicioSchema = z.object({
  name: z.string().trim().min(1, 'Escribe el nombre del ejercicio').max(80).optional(),
  muscleGroup: z.string().trim().max(40).nullable().optional(),
  notes: z.string().trim().max(300).nullable().optional(),
});

// Editar un ejercicio del catálogo. Renombrarlo no rompe nada: las tablas
// y los pesos apuntan a su id, no a su nombre.
export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  try {
    const datos = editarEjercicioSchema.parse(await request.json());
    const ejercicio = await prisma.exercise.update({
      where: { id: params.id },
      data: {
        name: datos.name,
        muscleGroup: datos.muscleGroup === undefined ? undefined : datos.muscleGroup || null,
        notes: datos.notes === undefined ? undefined : datos.notes || null,
      },
    });
    return NextResponse.json(ejercicio);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0].message }, { status: 400 });
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2002') {
        return NextResponse.json({ error: 'Ya existe un ejercicio con ese nombre' }, { status: 409 });
      }
      if (error.code === 'P2025') {
        return NextResponse.json({ error: 'Ejercicio no encontrado' }, { status: 404 });
      }
    }
    console.error('Error editando ejercicio:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

// Borrar un ejercicio solo se permite si no se ha usado nunca: si sale en
// alguna tabla o algún socio ya ha apuntado pesos con él, borrarlo haría
// perder ese historial de progreso.
export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  const ejercicio = await prisma.exercise.findUnique({
    where: { id: params.id },
    include: { _count: { select: { routineExercises: true, setLogs: true } } },
  });
  if (!ejercicio) {
    return NextResponse.json({ error: 'Ejercicio no encontrado' }, { status: 404 });
  }
  if (ejercicio._count.routineExercises > 0 || ejercicio._count.setLogs > 0) {
    return NextResponse.json(
      { error: 'No se puede borrar: ya se usa en alguna tabla o tiene pesos apuntados' },
      { status: 409 }
    );
  }

  await prisma.exercise.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
