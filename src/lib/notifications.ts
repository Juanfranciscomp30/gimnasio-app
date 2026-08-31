import { prisma } from '@/lib/prisma';

// Crea el mismo aviso para varios usuarios a la vez (ej: todos los
// apuntados a una clase que el admin acaba de cambiar de hora).
// No lanza si la lista está vacía, simplemente no hace nada.
export async function crearNotificaciones(userIds: string[], message: string) {
  if (userIds.length === 0) return;

  await prisma.notification.createMany({
    data: userIds.map((userId) => ({ userId, message })),
  });
}
