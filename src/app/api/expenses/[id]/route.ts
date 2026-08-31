import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

async function requireAdmin() {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any).role !== 'ADMIN') return null;
  return session;
}

// Elimina un gasto (ej: se registró por error).
export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  const gasto = await prisma.expense.findUnique({ where: { id: params.id } });
  if (!gasto) {
    return NextResponse.json({ error: 'Gasto no encontrado' }, { status: 404 });
  }

  await prisma.expense.delete({ where: { id: params.id } });

  return NextResponse.json({ ok: true });
}
