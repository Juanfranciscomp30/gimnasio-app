import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// Avisos dentro de la app del usuario logueado (ej: "tu clase cambió de
// hora"). Se usan en el banner de /inicio. Las más nuevas primero.
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const userId = (session.user as any).id;

  const notificaciones = await prisma.notification.findMany({
    where: { userId, read: false },
    orderBy: { createdAt: 'desc' },
    take: 20,
  });

  return NextResponse.json(notificaciones);
}
