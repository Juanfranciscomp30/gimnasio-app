import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';

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
      return NextResponse.json(
        { error: 'Ya existe una cuenta con ese email' },
        { status: 409 }
      );
    }

    // Encriptamos la contraseña. El "10" es el "coste" del hash:
    // cuanto más alto, más seguro pero más lento. 10 es un estándar razonable.
    const passwordHash = await bcrypt.hash(datos.password, 10);

    const nuevoUsuario = await prisma.user.create({
      data: {
        name: datos.name,
        email: datos.email,
        passwordHash,
        role: 'USER', // el registro público siempre crea usuarios normales,
                       // nunca administradores
      },
    });

    // OJO: nunca devolvemos el passwordHash en la respuesta
    return NextResponse.json(
      {
        id: nuevoUsuario.id,
        name: nuevoUsuario.name,
        email: nuevoUsuario.email,
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