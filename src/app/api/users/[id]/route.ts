import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

const actualizarUsuarioSchema = z.object({
  weeklyPlan: z.enum(['ONE_DAY', 'TWO_DAYS', 'THREE_DAYS']).optional(),
  role: z.enum(['ADMIN', 'USER']).optional(),
  // Acciones sobre una solicitud de baja pendiente (ver /perfil):
  // - confirmarBaja: el admin la procesa de verdad -> revoca el acceso
  //   (passwordHash a null, igual que un usuario sin activar) y limpia la solicitud
  // - rechazarBaja: descarta la solicitud sin tocar el acceso del usuario
  accion: z.enum(['confirmarBaja', 'rechazarBaja']).optional(),
});

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any).role !== 'ADMIN') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { accion, ...datos } = actualizarUsuarioSchema.parse(body);

    const dataActualizar: Record<string, unknown> = { ...datos };
    if (accion === 'confirmarBaja') {
      dataActualizar.passwordHash = null;
      dataActualizar.cancellationRequested = false;
      dataActualizar.cancellationRequestedAt = null;
    } else if (accion === 'rechazarBaja') {
      dataActualizar.cancellationRequested = false;
      dataActualizar.cancellationRequestedAt = null;
    }

    const usuarioActualizado = await prisma.user.update({
      where: { id: params.id },
      data: dataActualizar,
    });

    return NextResponse.json(usuarioActualizado);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0].message }, { status: 400 });
    }
    console.error('Error actualizando usuario:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}