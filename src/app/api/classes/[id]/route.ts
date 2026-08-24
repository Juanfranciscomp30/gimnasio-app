import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

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
        include: { user: { select: { id: true, name: true, email: true } } },
        orderBy: { createdAt: 'asc' },
      },
    },
  });

  if (!clase) {
    return NextResponse.json({ error: 'Clase no encontrada' }, { status: 404 });
  }

  return NextResponse.json(clase);
}