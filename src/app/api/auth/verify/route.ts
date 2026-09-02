import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// Enlace al que apunta el botón "Confirmar mi cuenta" del email.
// No es una API pensada para llamarse por fetch: es una navegación directa
// del usuario, por eso responde siempre con un redirect a /login.
export async function GET(request: Request) {
  const url = new URL(request.url);
  const token = url.searchParams.get('token');
  const base = process.env.NEXTAUTH_URL || url.origin;

  if (!token) {
    return NextResponse.redirect(`${base}/login?verificado=error`);
  }

  const usuario = await prisma.user.findUnique({
    where: { verificationToken: token },
  });

  const tokenValido =
    usuario && usuario.verificationTokenExpires && usuario.verificationTokenExpires > new Date();

  if (!usuario || !tokenValido) {
    return NextResponse.redirect(`${base}/login?verificado=error`);
  }

  await prisma.user.update({
    where: { id: usuario.id },
    data: {
      emailVerified: new Date(),
      verificationToken: null,
      verificationTokenExpires: null,
    },
  });

  return NextResponse.redirect(`${base}/login?verificado=ok`);
}
