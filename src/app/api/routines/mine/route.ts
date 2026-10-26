import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  INCLUDE_TABLA,
  REGEX_DIA,
  diaISO,
  fechaSesion,
  leerMes,
  requireUserId,
} from '@/lib/tablas';

type Serie = { setNumber: number; weight: number; reps: number };

// La tabla del mes que le toca al socio según su tarifa (1, 2 o 3 días) y
// la versión que sigue (hombre/mujer),
// junto con su historial de cada ejercicio de la tabla:
//  - "ultima": las series de la última vez que hizo ese ejercicio ANTES de
//    hoy, aunque fuera con otra tabla hace meses. Es lo que permite que la
//    app "recuerde" el peso cuando un ejercicio vuelve a salir.
//  - "hoy": lo que ya ha apuntado hoy (para poder corregirlo).
//  - "record": el mayor peso que ha levantado nunca en ese ejercicio.
//
// Query params: ?year=2026&month=10&today=2026-10-26 (el cliente manda su
// fecha para que "hoy" sea el día de España y no el del servidor).
export async function GET(request: Request) {
  const userId = await requireUserId();
  if (!userId) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const mes = leerMes(request.url);
  const hoyParam = new URL(request.url).searchParams.get('today');
  const hoyStr = hoyParam && REGEX_DIA.test(hoyParam) ? hoyParam : diaISO(new Date());
  if (!mes) {
    return NextResponse.json({ error: 'Mes no válido' }, { status: 400 });
  }

  const usuario = await prisma.user.findUnique({
    where: { id: userId },
    select: { weeklyPlan: true, routineVariant: true },
  });
  if (!usuario) {
    return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 });
  }

  const base = { weeklyPlan: usuario.weeklyPlan, variant: usuario.routineVariant };

  // Aún no ha dicho si sigue la tabla de hombre o de mujer: la pantalla
  // se lo pregunta antes de enseñarle nada.
  if (!usuario.routineVariant) {
    return NextResponse.json({ ...base, routine: null, historial: {} });
  }

  const tabla = await prisma.routine.findUnique({
    where: {
      year_month_weeklyPlan_variant: {
        year: mes.year,
        month: mes.month,
        weeklyPlan: usuario.weeklyPlan,
        variant: usuario.routineVariant,
      },
    },
    include: INCLUDE_TABLA,
  });

  if (!tabla) {
    return NextResponse.json({ ...base, routine: null, historial: {} });
  }

  const exerciseIds = Array.from(
    new Set(tabla.days.flatMap((d) => d.exercises.map((e) => e.exerciseId)))
  );
  const hoy = fechaSesion(hoyStr);

  // Fecha de la última sesión anterior a hoy y récord de cada ejercicio
  const [ultimasFechas, records] = await Promise.all([
    prisma.setLog.groupBy({
      by: ['exerciseId'],
      where: { userId, exerciseId: { in: exerciseIds }, sessionDate: { lt: hoy } },
      _max: { sessionDate: true },
    }),
    prisma.setLog.groupBy({
      by: ['exerciseId'],
      where: { userId, exerciseId: { in: exerciseIds } },
      _max: { weight: true },
    }),
  ]);

  // Una sola consulta para traer las series de esas últimas sesiones + hoy
  const filtrosUltimas = ultimasFechas
    .filter((u) => u._max.sessionDate)
    .map((u) => ({ exerciseId: u.exerciseId, sessionDate: u._max.sessionDate! }));

  const series = await prisma.setLog.findMany({
    where: {
      userId,
      OR: [...filtrosUltimas, { exerciseId: { in: exerciseIds }, sessionDate: hoy }],
    },
    orderBy: [{ sessionDate: 'asc' }, { setNumber: 'asc' }],
    select: { exerciseId: true, sessionDate: true, setNumber: true, weight: true, reps: true },
  });

  const historial: Record<
    string,
    { ultima: { date: string; sets: Serie[] } | null; hoy: Serie[]; record: number | null }
  > = {};

  for (const id of exerciseIds) {
    historial[id] = {
      ultima: null,
      hoy: [],
      record: records.find((r) => r.exerciseId === id)?._max.weight ?? null,
    };
  }

  for (const s of series) {
    const serie = { setNumber: s.setNumber, weight: s.weight, reps: s.reps };
    const dia = diaISO(s.sessionDate);
    const h = historial[s.exerciseId];
    if (dia === hoyStr) {
      h.hoy.push(serie);
    } else {
      if (!h.ultima) h.ultima = { date: dia, sets: [] };
      h.ultima.sets.push(serie);
    }
  }

  return NextResponse.json({ ...base, routine: tabla, historial });
}
