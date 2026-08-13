'use client';

import Link from 'next/link';
import { signOut, useSession } from 'next-auth/react';

export default function UserNavbar() {
  const { data: session } = useSession();

  return (
    <nav className="bg-gray-900 text-white px-6 py-3 flex items-center justify-between">
      <div className="flex items-center gap-6">
        <span className="font-bold">Gimnasio</span>
        <Link href="/mis-clases" className="text-sm hover:underline">
          Mis clases
        </Link>
      </div>
      <div className="flex items-center gap-4 text-sm">
        <span className="text-gray-300">{session?.user?.name}</span>
        <button
          onClick={() => signOut({ callbackUrl: '/login' })}
          className="bg-gray-700 px-3 py-1 rounded hover:bg-gray-600"
        >
          Cerrar sesión
        </button>
      </div>
    </nav>
  );
}