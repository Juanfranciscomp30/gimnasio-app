import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

const crearGastoSchema = z.object({
  concept: z.string().trim().min(1, 'Escribe un concepto'),
  amount: z.number().positive('El importe debe ser mayor que 0'),
  category: z.string().trim().min(1).optional(),
  date: z.string().datetime().optional(),
});

async function requireAdmin() {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any).role !== 'ADMIN') return null;
  return session;
}

// Lista todos los gastos del gimnasio (luz, maquinaria, etc.), el más
// reciente primero. Solo ADMIN — es la contabilidad interna del negocio.
export async function GET() {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  const gastos = await prisma.expense.findMany({
    orderBy: { date: 'desc' },
  });

  return NextResponse.json(gastos);
}

// Registra un gasto nuevo.
export async function POST(request: Request) {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const datos = crearGastoSchema.parse(body);

    const gasto = await prisma.expense.create({
      data: {
        concept: datos.concept,
        amount: datos.amount,
        category: datos.category,
        date: datos.date ? new Date(datos.date) : new Date(),
      },
    });

    return NextResponse.json(gasto, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0].message }, { status: 400 });
    }
    console.error('Error registrando gasto:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
