import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { REGEX_DIA, diaISO, fechaSesion, requireUserId } from '@/lib/tablas';

const guardarSeriesSchema = z.object({
  exerciseId: z.string().min(1),
  date: z.string().regex(REGEX_DIA, 'Fecha no válida'),
  sets: z
    .array(
      z.object({
        weight: z.number().min(0, 'El peso no puede ser negativo').max(1000),
        reps: z.number().int().min(0).max(500),
      })
    )
    .max(20),
});

// Guarda las series de un ejercicio en un día. Reemplaza lo que hubiera
// apuntado ese día para ese ejercicio, así el socio puede corregir un peso
// mal escrito sin duplicar series. Con sets: [] se borra lo de ese día.
export async function POST(request: Request) {
  const userId = await requireUserId();
  if (!userId) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  try {
    const datos = guardarSeriesSchema.parse(await request.json());

    // Margen de un día por la diferencia horaria entre España y el servidor
    const manana = new Date();
    manana.setUTCDate(manana.getUTCDate() + 1);
    if (datos.date > diaISO(manana)) {
      return NextResponse.json({ error: 'No puedes apuntar pesos de días futuros' }, { status: 400 });
    }

    const ejercicio = await prisma.exercise.findUnique({ where: { id: datos.exerciseId } });
    if (!ejercicio) {
      return NextResponse.json({ error: 'Ejercicio no encontrado' }, { status: 404 });
    }

    const sessionDate = fechaSesion(datos.date);
    await prisma.$transaction([
      prisma.setLog.deleteMany({ where: { userId, exerciseId: datos.exerciseId, sessionDate } }),
      prisma.setLog.createMany({
        data: datos.sets.map((s, i) => ({
          userId,
          exerciseId: datos.exerciseId,
          sessionDate,
          setNumber: i + 1,
          weight: s.weight,
          reps: s.reps,
        })),
      }),
    ]);

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0].message }, { status: 400 });
    }
    console.error('Error guardando series:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

// Progreso del socio: para cada ejercicio que ha hecho alguna vez, sus
// sesiones en orden (fecha, peso máximo y series). Es lo que pinta las
// gráficas de "Mi progreso".
export async function GET() {
  const userId = await requireUserId();
  if (!userId) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const series = await prisma.setLog.findMany({
    where: { userId },
    orderBy: [{ sessionDate: 'asc' }, { setNumber: 'asc' }],
    select: {
      sessionDate: true,
      weight: true,
      reps: true,
      exercise: { select: { id: true, name: true, muscleGroup: true } },
    },
  });

  type Sesion = { date: string; maxWeight: number; sets: { weight: number; reps: number }[] };
  const porEjercicio = new Map<
    string,
    { exerciseId: string; name: string; muscleGroup: string | null; sesiones: Sesion[] }
  >();

  for (const s of series) {
    let ej = porEjercicio.get(s.exercise.id);
    if (!ej) {
      ej = {
        exerciseId: s.exercise.id,
        name: s.exercise.name,
        muscleGroup: s.exercise.muscleGroup,
        sesiones: [],
      };
      porEjercicio.set(s.exercise.id, ej);
    }
    const dia = diaISO(s.sessionDate);
    let sesion = ej.sesiones[ej.sesiones.length - 1];
    if (!sesion || sesion.date !== dia) {
      sesion = { date: dia, maxWeight: 0, sets: [] };
      ej.sesiones.push(sesion);
    }
    sesion.sets.push({ weight: s.weight, reps: s.reps });
    sesion.maxWeight = Math.max(sesion.maxWeight, s.weight);
  }

  // Primero los ejercicios entrenados más recientemente
  const progreso = Array.from(porEjercicio.values())
    .map((e) => ({
      ...e,
      record: Math.max(...e.sesiones.map((s) => s.maxWeight)),
      ultimaFecha: e.sesiones[e.sesiones.length - 1].date,
    }))
    .sort((a, b) => b.ultimaFecha.localeCompare(a.ultimaFecha));

  return NextResponse.json(progreso);
}
