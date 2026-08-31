import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// Las clases no tienen un campo de duración en la base de datos, así que
// asumimos 60 minutos (fácil de ajustar aquí si en el futuro se añade
// un campo real de duración al modelo ClassSession).
const DURACION_CLASE_MINUTOS = 60;

function comoICS(fecha: Date): string {
  return fecha.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
}

// Devuelve un archivo .ics descargable para una reserva confirmada, para
// que el usuario pueda añadir la clase a su calendario (Google, Apple, etc.)
export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const reserva = await prisma.booking.findUnique({
    where: { id: params.id },
    include: { classSession: true },
  });

  if (!reserva || reserva.userId !== (session.user as any).id) {
    return NextResponse.json({ error: 'Reserva no encontrada' }, { status: 404 });
  }

  if (reserva.status !== 'CONFIRMED') {
    return NextResponse.json({ error: 'Esta reserva no está confirmada' }, { status: 409 });
  }

  const inicio = reserva.classSession.date;
  const fin = new Date(inicio.getTime() + DURACION_CLASE_MINUTOS * 60 * 1000);

  const ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Gimnasio//Reservas//ES',
    'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `UID:${reserva.id}@gimnasio-app`,
    `DTSTAMP:${comoICS(new Date())}`,
    `DTSTART:${comoICS(inicio)}`,
    `DTEND:${comoICS(fin)}`,
    'SUMMARY:Clase de gimnasio',
    'DESCRIPTION:Tu clase reservada en el gimnasio.',
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');

  return new NextResponse(ics, {
    status: 200,
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': 'attachment; filename="clase.ics"',
    },
  });
}
