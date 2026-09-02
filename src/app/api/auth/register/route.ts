import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { enviarEmailVerificacion } from '@/lib/email';

// Las cuentas sin confirmar caducan a las 24h: pasado ese tiempo, si alguien
// vuelve a registrarse con ese mismo email, se descarta la cuenta vieja y se
// crea una nueva (así no hace falta un cron aparte para limpiar bots).
const HORAS_EXPIRACION_TOKEN = 24;

// Definimos con zod qué forma deben tener los datos que llegan.
// Si no cumplen esto, se rechaza la petición antes de tocar la base de datos.
const registerSchema = z.object({
  name: z.string().min(2, 'El nombre es demasiado corto'),
  email: z.string().email('Email no válido'),
  password: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres'),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const datos = registerSchema.parse(body);

    // Comprobamos que no exista ya un usuario con ese email
    const usuarioExistente = await prisma.user.findUnique({
      where: { email: datos.email },
    });

    if (usuarioExistente) {
      const tokenCaducado =
        !usuarioExistente.verificationTokenExpires ||
        usuarioExistente.verificationTokenExpires < new Date();

      if (usuarioExistente.emailVerified || !tokenCaducado) {
        // Ya hay una cuenta confirmada, o una pendiente cuyo enlace
        // todavía es válido: no dejamos crear otra igual.
        return NextResponse.json(
          usuarioExistente.emailVerified
            ? { error: 'Ya existe una cuenta con ese email' }
            : {
                error:
                  'Ya hay una cuenta pendiente de confirmar con ese email. Revisa tu correo o pide que te reenviemos el enlace desde la pantalla de inicio de sesión.',
              },
          { status: 409 }
        );
      }

      // Cuenta antigua nunca confirmada y con el enlace ya caducado:
      // la eliminamos para poder dar de alta la nueva.
      await prisma.user.delete({ where: { id: usuarioExistente.id } });
    }

    // Encriptamos la contraseña. El "10" es el "coste" del hash:
    // cuanto más alto, más seguro pero más lento. 10 es un estándar razonable.
    const passwordHash = await bcrypt.hash(datos.password, 10);

    const token = crypto.randomBytes(32).toString('hex');
    const tokenExpires = new Date(Date.now() + HORAS_EXPIRACION_TOKEN * 60 * 60 * 1000);

    const nuevoUsuario = await prisma.user.create({
      data: {
        name: datos.name,
        email: datos.email,
        passwordHash,
        role: 'USER', // el registro público siempre crea usuarios normales,
                       // nunca administradores
        emailVerified: null, // pendiente de confirmar
        verificationToken: token,
        verificationTokenExpires: tokenExpires,
      },
    });

    try {
      await enviarEmailVerificacion(nuevoUsuario.email, nuevoUsuario.name, token);
    } catch (emailError) {
      // Si el correo no ha podido enviarse, no dejamos una cuenta "colgada"
      // que nunca podría confirmarse: la borramos y avisamos para que lo
      // intente de nuevo.
      await prisma.user.delete({ where: { id: nuevoUsuario.id } });
      console.error('Registro cancelado: fallo al enviar email de verificación', emailError);
      return NextResponse.json(
        { error: 'No se pudo enviar el correo de confirmación. Inténtalo de nuevo en unos minutos.' },
        { status: 502 }
      );
    }

    // OJO: nunca devolvemos el passwordHash ni el token en la respuesta
    return NextResponse.json(
      {
        id: nuevoUsuario.id,
        name: nuevoUsuario.name,
        email: nuevoUsuario.email,
        mensaje: 'Cuenta creada. Revisa tu correo para confirmarla antes de iniciar sesión.',
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.errors[0].message },
        { status: 400 }
      );
    }

    console.error('Error en registro:', error);
    return NextResponse.json(
      { error: 'Error interno al registrar el usuario' },
      { status: 500 }
    );
  }
}
