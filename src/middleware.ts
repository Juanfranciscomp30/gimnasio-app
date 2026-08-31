import { withAuth } from 'next-auth/middleware';
import { NextResponse } from 'next/server';

// withAuth envuelve nuestra lógica y, antes de ejecutarla, ya se asegura
// de tener disponible el token de sesión (si existe) en req.nextauth.token
export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token;
    const { pathname } = req.nextUrl;

    // Si intenta entrar a cualquier ruta /admin/* sin ser ADMIN, lo echamos
    if (pathname.startsWith('/admin') && token?.role !== 'ADMIN') {
      return NextResponse.redirect(new URL('/', req.url));
    }

    return NextResponse.next();
  },
  {
    callbacks: {
      // Esta función decide si el middleware de arriba llega a ejecutarse.
      // Si devuelve false, NextAuth redirige automáticamente a /login.
      authorized: ({ token }) => !!token, // solo exige "estar logueado";
      // el detalle de "ser admin o no" ya lo comprobamos arriba
    },
  }
);

// matcher: le decimos a Next.js EN QUÉ RUTAS debe ejecutarse este
// middleware. Fuera de esta lista (ej: /, /login, /register) no se aplica,
// para que cualquiera pueda ver la home o registrarse sin estar logueado.
export const config = {
  matcher: ['/admin/:path*', '/mis-clases/:path*', '/perfil/:path*', '/inicio/:path*'],
};