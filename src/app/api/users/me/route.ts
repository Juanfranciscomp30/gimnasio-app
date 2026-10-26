import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// Devuelve los datos del usuario logueado (para pintar /perfil)
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const usuario = await prisma.user.findUnique({
    where: { id: (session.user as any).id },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      weeklyPlan: true,
      profileImageUrl: true,
      cancellationRequested: true,
      cancellationRequestedAt: true,
      routineVariant: true,
    },
  });

  if (!usuario) {
    return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 });
  }

  return NextResponse.json(usuario);
}

const actualizarPerfilSchema = z.object({
  // Solicitar la baja (true) o retirar su solicitud mientras el admin no
  // la haya procesado (false).
  cancellationRequested: z.boolean().optional(),
  // Qué versión de las tablas de ejercicios sigue (hombre/mujer).
  routineVariant: z.enum(['MEN', 'WOMEN']).optional(),
});

// El propio usuario solicita o retira su baja, o elige su versión de las
// tablas de ejercicios. No puede tocar su plan, rol ni ningún otro dato:
// eso solo lo hace el admin desde /admin/usuarios.
export async function PATCH(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { cancellationRequested, routineVariant } = actualizarPerfilSchema.parse(body);

    const usuarioActualizado = await prisma.user.update({
      where: { id: (session.user as any).id },
      data: {
        routineVariant,
        ...(cancellationRequested !== undefined && {
          cancellationRequested,
          cancellationRequestedAt: cancellationRequested ? new Date() : null,
        }),
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        weeklyPlan: true,
        profileImageUrl: true,
        cancellationRequested: true,
        cancellationRequestedAt: true,
        routineVariant: true,
      },
    });

    return NextResponse.json(usuarioActualizado);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0].message }, { status: 400 });
    }
    console.error('Error actualizando perfil:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
