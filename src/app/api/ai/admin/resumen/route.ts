import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { Prisma } from '@prisma/client';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { generarResumenSemanal } from '@/lib/ai/admin';
import { IaNoConfiguradaError, iaDisponible } from '@/lib/ai/client';

const KIND = 'RESUMEN_SEMANAL';
// El resumen se reutiliza durante unas horas: abrir la página no gasta
// API cada vez. Con "Actualizar" se fuerza uno nuevo (si han pasado 10 min).
const CACHE_HORAS = 12;
const MIN_ENTRE_REFRESCOS_MIN = 10;

async function requireAdmin() {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any).role !== 'ADMIN') return null;
  return session;
}

// GET /api/ai/admin/resumen            → último resumen (o genera si caducó)
// GET /api/ai/admin/resumen?refrescar=1 → fuerza uno nuevo
export async function GET(request: Request) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }
  if (!iaDisponible()) {
    return NextResponse.json({ iaDisponible: false, informe: null });
  }

  const refrescar = new URL(request.url).searchParams.get('refrescar') === '1';
  const ultimo = await prisma.aiReport.findFirst({ where: { kind: KIND }, orderBy: { createdAt: 'desc' } });
  const edadMin = ultimo ? (Date.now() - ultimo.createdAt.getTime()) / 60000 : Infinity;

  const sirveElUltimo = ultimo && (refrescar ? edadMin < MIN_ENTRE_REFRESCOS_MIN : edadMin < CACHE_HORAS * 60);
  if (sirveElUltimo) {
    return NextResponse.json({ iaDisponible: true, informe: ultimo });
  }

  try {
    const content = await generarResumenSemanal();
    const informe = await prisma.aiReport.create({
      data: { kind: KIND, content: content as Prisma.InputJsonValue },
    });
    return NextResponse.json({ iaDisponible: true, informe });
  } catch (error) {
    if (error instanceof IaNoConfiguradaError) {
      return NextResponse.json({ iaDisponible: false, informe: null });
    }
    console.error('Error generando resumen IA:', error);
    // Si falla pero hay uno anterior, mejor enseñar ese que nada
    if (ultimo) return NextResponse.json({ iaDisponible: true, informe: ultimo, aviso: 'No se pudo actualizar' });
    return NextResponse.json({ error: 'No se ha podido generar el resumen' }, { status: 502 });
  }
}
