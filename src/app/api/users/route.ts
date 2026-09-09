import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

const crearUsuarioManualSchema = z.object({
  name: z.string().min(2, 'El nombre es demasiado corto'),
  email: z.string().email('Email no válido'),
  weeklyPlan: z.enum(['ONE_DAY', 'TWO_DAYS', 'THREE_DAYS']),
});

async function requireAdmin() {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any).role !== 'ADMIN') {
    return null;
  }
  return session;
}

// Lista todos los usuarios (solo admin)
export async function GET() {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  const usuarios = await prisma.user.findMany({
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      weeklyPlan: true,
      createdByAdmin: true,
      passwordHash: true, // lo pedimos solo para saber si es null, NUNCA se lo mandamos al frontend
      createdAt: true,
      cancellationRequested: true,
      cancellationRequestedAt: true,
      profileImageUrl: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  // Quitamos el hash real y dejamos solo un booleano "tieneAcceso"
  const usuariosSeguros = usuarios.map((u) => ({
    ...u,
    passwordHash: undefined,
    tieneAcceso: !!u.passwordHash,
  }));

  return NextResponse.json(usuariosSeguros);
}

// Crea un usuario manualmente, SIN contraseña (el admin lo da de alta,
// la persona aún no puede iniciar sesión hasta que se le active el acceso)
export async function POST(request: Request) {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const datos = crearUsuarioManualSchema.parse(body);

    const existente = await prisma.user.findUnique({ where: { email: datos.email } });
    if (existente) {
      return NextResponse.json({ error: 'Ya existe un usuario con ese email' }, { status: 409 });
    }

    const nuevoUsuario = await prisma.user.create({
      data: {
        name: datos.name,
        email: datos.email,
        weeklyPlan: datos.weeklyPlan,
        role: 'USER',
        createdByAdmin: true,
        passwordHash: null, // sin acceso todavía
        // Lo da de alta el admin directamente: no necesita confirmar el
        // email como en el registro público (ahí es donde nos protegemos
        // de bots, no aquí).
        emailVerified: new Date(),
      },
    });

    return NextResponse.json(nuevoUsuario, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0].message }, { status: 400 });
    }
    console.error('Error creando usuario manual:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}