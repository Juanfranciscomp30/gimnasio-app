import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// Supabase (plan gratuito) pausa el proyecto si pasa ~1 semana sin
// actividad en la base de datos, y entonces la demo pública deja de
// funcionar. Un cron de Vercel (ver vercel.json) llama aquí una vez al día
// y hace una consulta mínima para que el proyecto cuente como activo.
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  // Si está definida CRON_SECRET en Vercel, solo el cron puede llamar aquí
  // (Vercel manda "Authorization: Bearer <CRON_SECRET>" automáticamente).
  const secreto = process.env.CRON_SECRET;
  if (secreto && request.headers.get('authorization') !== `Bearer ${secreto}`) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  try {
    const usuarios = await prisma.user.count();
    return NextResponse.json({ ok: true, usuarios, at: new Date().toISOString() });
  } catch (error) {
    console.error('Keep-alive: la base de datos no responde', error);
    return NextResponse.json({ ok: false }, { status: 503 });
  }
}
