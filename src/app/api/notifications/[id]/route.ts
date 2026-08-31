import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// Marca un aviso propio como leído (el usuario lo descarta en /inicio).
export async function PATCH(_request: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const userId = (session.user as any).id;

  const notificacion = await prisma.notification.findUnique({ where: { id: params.id } });
  if (!notificacion || notificacion.userId !== userId) {
    return NextResponse.json({ error: 'Aviso no encontrado' }, { status: 404 });
  }

  await prisma.notification.update({
    where: { id: params.id },
    data: { read: true },
  });

  return NextResponse.json({ ok: true });
}
