import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { enviarEmailVerificacion } from '@/lib/email';

const HORAS_EXPIRACION_TOKEN = 24;

const schema = z.object({
  email: z.string().email('Email no válido'),
});

// Mensaje genérico SIEMPRE igual (exista o no exista esa cuenta, esté
// verificada o no) para no dar pistas a quien pruebe emails al azar sobre
// qué cuentas existen en la base de datos.
const MENSAJE_GENERICO = {
  mensaje:
    'Si hay una cuenta pendiente de confirmar con ese email, te hemos enviado un nuevo enlace.',
};

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email } = schema.parse(body);

    const usuario = await prisma.user.findUnique({ where: { email } });

    if (usuario && !usuario.emailVerified) {
      const token = crypto.randomBytes(32).toString('hex');
      const tokenExpires = new Date(Date.now() + HORAS_EXPIRACION_TOKEN * 60 * 60 * 1000);

      await prisma.user.update({
        where: { id: usuario.id },
        data: { verificationToken: token, verificationTokenExpires: tokenExpires },
      });

      // Si el envío falla no rompemos la respuesta al usuario (sigue siendo
      // el mismo mensaje genérico); solo lo dejamos registrado en el log.
      try {
        await enviarEmailVerificacion(usuario.email, usuario.name, token);
      } catch (emailError) {
        console.error('Error reenviando email de verificación:', emailError);
      }
    }

    return NextResponse.json(MENSAJE_GENERICO, { status: 200 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0].message }, { status: 400 });
    }
    console.error('Error en resend-verification:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
