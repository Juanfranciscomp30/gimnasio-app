import { prisma } from '@/lib/prisma';
import { LIMITE_POR_PLAN } from '@/lib/booking-logic';
import { OBJETIVOS, NIVELES, DIETAS } from '@/lib/ai/opciones';

// Junta en un texto corto lo que la IA necesita saber de un socio.
// IMPORTANTE: solo mandamos el nombre de pila y datos de uso del gimnasio;
// nunca email, ni pagos, ni nada que no haga falta para personalizar.

const SEMANAS_HISTORIAL = 8;

export async function contextoSocio(userId: string) {
  const desde = new Date();
  desde.setDate(desde.getDate() - SEMANAS_HISTORIAL * 7);

  const [usuario, perfil, reservas] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { name: true, weeklyPlan: true },
    }),
    prisma.fitnessProfile.findUnique({ where: { userId } }),
    prisma.booking.findMany({
      where: { userId, classSession: { date: { gte: desde, lte: new Date() } } },
      select: { status: true },
    }),
  ]);

  if (!usuario) return null;

  const asistidas = reservas.filter((r) => r.status === 'CONFIRMED').length;
  const tardias = reservas.filter((r) => r.status === 'CANCELLED_LATE').length;
  const diasSemana = LIMITE_POR_PLAN[usuario.weeklyPlan];

  const lineas = [
    `Nombre de pila: ${usuario.name.split(' ')[0]}`,
    `Tarifa: ${diasSemana} día(s) de clase por semana en el gimnasio`,
    `Clases asistidas en las últimas ${SEMANAS_HISTORIAL} semanas: ${asistidas} (de ${diasSemana * SEMANAS_HISTORIAL} posibles)`,
    `Cancelaciones tardías en ese periodo: ${tardias}`,
  ];

  if (perfil) {
    lineas.push(
      `Objetivo: ${OBJETIVOS[perfil.goal as keyof typeof OBJETIVOS] ?? perfil.goal}`,
      `Nivel: ${NIVELES[perfil.level as keyof typeof NIVELES] ?? perfil.level}`,
      `Duración de cada sesión: ${perfil.minutesPerSession} minutos`,
      `Quiere rutinas cortas para casa los días que no viene: ${perfil.trainsAtHome ? 'sí' : 'no'}`
    );
    if (perfil.dietPreference) {
      lineas.push(`Preferencia de alimentación: ${DIETAS[perfil.dietPreference as keyof typeof DIETAS] ?? perfil.dietPreference}`);
    }
    if (perfil.limitations) {
      lineas.push(`Limitaciones o molestias indicadas por el socio: ${perfil.limitations}`);
    }
  }

  return { texto: lineas.join('\n'), diasSemana, tienePerfil: !!perfil };
}
