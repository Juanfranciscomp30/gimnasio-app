import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { OBJETIVOS, NIVELES, DIETAS, MINUTOS_SESION } from '@/lib/ai/opciones';

// Cuestionario fitness del socio logueado (lo usa la IA para personalizar).

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const perfil = await prisma.fitnessProfile.findUnique({
    where: { userId: (session.user as any).id },
  });

  // null = aún no lo ha rellenado (el front muestra el cuestionario vacío)
  return NextResponse.json(perfil);
}

// z.enum necesita una tupla con al menos un elemento; Object.keys devuelve
// string[], así que hacemos el cast una vez aquí.
const claves = <T extends Record<string, string>>(o: T) =>
  Object.keys(o) as [keyof T & string, ...(keyof T & string)[]];

const perfilSchema = z.object({
  goal: z.enum(claves(OBJETIVOS)),
  level: z.enum(claves(NIVELES)),
  minutesPerSession: z
    .number()
    .int()
    .refine((m) => (MINUTOS_SESION as readonly number[]).includes(m), 'Duración no válida'),
  trainsAtHome: z.boolean(),
  dietPreference: z.enum(claves(DIETAS)).nullable(),
  limitations: z
    .string()
    .trim()
    .max(200, 'Máximo 200 caracteres')
    .nullable()
    .transform((v) => (v ? v : null)),
});

export async function PUT(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  try {
    const datos = perfilSchema.parse(await request.json());
    const userId = (session.user as any).id;

    // upsert = "créalo si no existe, actualízalo si ya existe"
    const perfil = await prisma.fitnessProfile.upsert({
      where: { userId },
      create: { userId, ...datos },
      update: datos,
    });

    return NextResponse.json(perfil);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0].message }, { status: 400 });
    }
    console.error('Error guardando perfil fitness:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
