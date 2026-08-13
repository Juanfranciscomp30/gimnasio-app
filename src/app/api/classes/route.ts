import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

const crearClaseSchema = z.object({
  date: z.string().datetime(), // fecha+hora en formato ISO, ej: 2026-08-20T18:00:00
  capacity: z.number().int().positive(),
});

// Cualquiera logueado puede LEER las clases (necesario para que el usuario
// vea qué hay disponible y se apunte)
export async function GET() {
  const clases = await prisma.classSession.findMany({
    orderBy: { date: 'asc' },
    include: {
      // _count nos da el número de reservas sin traer todos los datos de cada una
      _count: {
        select: { bookings: { where: { status: 'CONFIRMED' } } },
      },
    },
  });

  return NextResponse.json(clases);
}

// Solo el ADMIN puede CREAR clases
export async function POST(request: Request) {
  const session = await getServerSession(authOptions);

  if (!session || (session.user as any).role !== 'ADMIN') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const datos = crearClaseSchema.parse(body);

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