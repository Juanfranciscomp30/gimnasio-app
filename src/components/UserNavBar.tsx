'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut, useSession } from 'next-auth/react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faRightFromBracket } from '@fortawesome/free-solid-svg-icons';
import clsx from 'clsx';

export default function UserNavbar() {
  const { data: session } = useSession();
  const pathname = usePathname();
  const inicial = session?.user?.name?.charAt(0).toUpperCase() ?? 'U';
  const activeInicio = pathname === '/inicio';
  const activeMisClases = pathname === '/mis-clases';
  const activePerfil = pathname === '/perfil';

  // La sesión de NextAuth no lleva la foto de perfil (solo se rellena al
  // hacer login), así que la pedimos aparte. Escuchamos también el evento
  // que dispara /perfil al subir o quitar una foto, para que el navbar se
  // actualice al momento sin tener que recargar la página.
  const [fotoUrl, setFotoUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!session) return;
    fetch('/api/users/me')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => setFotoUrl(data?.profileImageUrl ?? null))
      .catch(() => {});
  }, [session]);

  useEffect(() => {
    function onAvatarActualizado(e: Event) {
      const detalle = (e as CustomEvent<{ profileImageUrl: string | null }>).detail;
      setFotoUrl(detalle?.profileImageUrl ?? null);
    }
    window.addEventListener('avatar-actualizado', onAvatarActualizado);
    return () => window.removeEventListener('avatar-actualizado', onAvatarActualizado);
  }, []);

  return (
    <nav className="bg-[#0F1115] border-b border-white/5 px-6 py-3 flex items-center justify-between">
      <div className="flex items-center gap-8">
        <span className="font-bold text-white tracking-tight">Gimnasio</span>
        <Link
          href="/inicio"
          className={clsx(
            'text-sm px-3 py-1.5 rounded-lg transition-colors',
            activeInicio
              ? 'bg-[#C6F135]/10 text-[#C6F135] font-medium'
              : 'text-gray-400 hover:text-white hover:bg-white/5'
          )}
        >
          Inicio
        </Link>
        <Link
          href="/mis-clases"
          className={clsx(
            'text-sm px-3 py-1.5 rounded-lg transition-colors',
            activeMisClases
              ? 'bg-[#C6F135]/10 text-[#C6F135] font-medium'
              : 'text-gray-400 hover:text-white hover:bg-white/5'
          )}
        >
          Mis clases
        </Link>
        <Link
          href="/perfil"
          className={clsx(
            'text-sm px-3 py-1.5 rounded-lg transition-colors',
            activePerfil
              ? 'bg-[#C6F135]/10 text-[#C6F135] font-medium'
              : 'text-gray-400 hover:text-white hover:bg-white/5'
          )}
        >
          Perfil
        </Link>
      </div>

      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2.5">
          {fotoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={fotoUrl} alt="" className="w-7 h-7 rounded-full object-cover" />
          ) : (
            <div className="w-7 h-7 rounded-full bg-[#C6F135]/15 text-[#C6F135] flex items-center justify-center text-xs font-semibold">
              {inicial}
            </div>
          )}
          <span className="text-sm text-gray-300 hidden sm:inline">{session?.user?.name}</span>
        </div>
        <button
          onClick={() => signOut({ callbackUrl: '/login' })}
          className="flex items-center gap-2 text-sm text-gray-400 hover:text-white bg-white/5 hover:bg-white/10 px-3 py-1.5 rounded-lg transition-colors"
        >
          <FontAwesomeIcon icon={faRightFromBracket} className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Cerrar sesión</span>
        </button>
      </div>
    </nav>
  );
}