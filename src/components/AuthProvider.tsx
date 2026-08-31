'use client';

import { SessionProvider } from 'next-auth/react';

// Este componente es solo un "envoltorio". NextAuth necesita que toda la
// app esté dentro de un SessionProvider para que hooks como useSession()
// funcionen en cualquier página o componente.
export default function AuthProvider({ children }: { children: React.ReactNode }) {
  return <SessionProvider>{children}</SessionProvider>;
}