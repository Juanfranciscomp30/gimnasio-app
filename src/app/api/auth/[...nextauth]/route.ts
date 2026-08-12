import NextAuth from 'next-auth';
import { authOptions } from '@/lib/auth';

const handler = NextAuth(authOptions);

// Next.js App Router necesita exportar la función tanto para
// peticiones GET (ej: consultar la sesión) como POST (ej: enviar el login)
export { handler as GET, handler as POST };