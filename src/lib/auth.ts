import { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';

export const authOptions: NextAuthOptions = {
  session: {
    strategy: 'jwt', // guardamos la sesión en un token, no en la base de datos
  },
  pages: {
    signIn: '/login', // usamos nuestra propia página de login, no la de NextAuth por defecto
  },
  providers: [
    CredentialsProvider({
      name: 'Credenciales',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Contraseña', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        // 1. Buscamos al usuario por email
        const user = await prisma.user.findUnique({
          where: { email: credentials.email },
        });

        // Si no existe, o fue creado manualmente por el admin y aún no tiene
        // contraseña asignada, no puede iniciar sesión.
        if (!user || !user.passwordHash) {
          return null;
        }

        // 2. Comparamos la contraseña escrita con el hash guardado
        const passwordValida = await bcrypt.compare(credentials.password, user.passwordHash);
        if (!passwordValida) {
          return null;
        }

        // 3. Devolvemos los datos que queremos que viajen en la sesión
        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role, // 'ADMIN' o 'USER'
        };
      },
    }),
  ],
  callbacks: {
    // Este callback se ejecuta cuando se crea/actualiza el token de sesión
    async jwt({ token, user }) {
      if (user) {
        token.role = (user as any).role;
        token.id = (user as any).id;
      }
      return token;
    },
    // Este callback traslada los datos del token a "session", que es lo que
    // usaremos en el frontend con useSession() o en el backend con getServerSession()
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).role = token.role;
        (session.user as any).id = token.id;
      }
      return session;
    },
  },
};