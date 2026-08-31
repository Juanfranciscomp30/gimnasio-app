'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut, useSession } from 'next-auth/react';
import { motion } from 'framer-motion';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faRightFromBracket,
  faHouse,
  faDumbbell,
  faUser,
} from '@fortawesome/free-solid-svg-icons';
import clsx from 'clsx';

const LINKS = [
  { href: '/inicio', label: 'Inicio', icon: faHouse },
  { href: '/mis-clases', label: 'Mis clases', icon: faDumbbell },
  { href: '/perfil', label: 'Perfil', icon: faUser },
];

export default function UserNavbar() {
  const { data: session } = useSession();
  const pathname = usePathname();
  const inicial = session?.user?.name?.charAt(0).toUpperCase() ?? 'U';

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
    <>
      {/* Barra superior flotante: logo, navegación de escritorio, cuenta */}
      <div className="sticky top-3 z-30 px-3 sm:px-6">
        <nav className="max-w-4xl mx-auto bg-card/90 backdrop-blur-md border border-white/10 rounded-2xl shadow-card px-3 sm:px-4 py-2 flex items-center justify-between">
          <Link href="/inicio" className="flex items-center gap-2 shrink-0">
            <span className="w-8 h-8 rounded-xl bg-gradient-accent flex items-center justify-center shadow-glow">
              <FontAwesomeIcon icon={faDumbbell} className="w-3.5 h-3.5 text-page" />
            </span>
            <span className="font-extrabold tracking-tight text-white inline">Gimnasio</span>
          </Link>

          <div className="hidden sm:flex items-center gap-1">
            {LINKS.map((link) => {
              const active = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={clsx(
                    'relative flex items-center gap-2 text-sm px-3 py-1.5 rounded-xl font-medium transition-colors',
                    active ? 'text-accent' : 'text-gray-400 hover:text-white'
                  )}
                >
                  {active && (
                    <motion.span
                      layoutId="user-nav-desktop-pill"
                      className="absolute inset-0 bg-accentsoft rounded-xl"
                      transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                    />
                  )}
                  <FontAwesomeIcon icon={link.icon} className="relative w-3 h-3" />
                  <span className="relative">{link.label}</span>
                </Link>
              );
            })}
          </div>

          <div className="flex items-center gap-2">
            <Link href="/perfil" className="flex items-center gap-2">
              {fotoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={fotoUrl}
                  alt=""
                  className="w-8 h-8 rounded-full object-cover ring-2 ring-accent/30"
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-accentsoft text-accent flex items-center justify-center text-xs font-bold ring-2 ring-accent/20">
                  {inicial}
                </div>
              )}
            </Link>
            <motion.button
              whileHover={{ scale: 1.06 }}
              whileTap={{ scale: 0.94 }}
              onClick={() => signOut({ callbackUrl: '/login' })}
              title="Cerrar sesión"
              className="w-8 h-8 rounded-full bg-white/5 hover:bg-dangersoft text-gray-400 hover:text-danger flex items-center justify-center transition-colors"
            >
              <FontAwesomeIcon icon={faRightFromBracket} className="w-3.5 h-3.5" />
            </motion.button>
          </div>
        </nav>
      </div>

      {/* Barra inferior flotante: navegación estilo app móvil, solo en pantallas pequeñas */}
      <nav className="sm:hidden fixed bottom-3 inset-x-3 z-30">
        <div className="max-w-sm mx-auto bg-card/90 backdrop-blur-md border border-white/10 rounded-2xl shadow-card px-2 py-1.5 flex items-stretch justify-around mb-[env(safe-area-inset-bottom)]">
          {LINKS.map((link) => {
            const active = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className="relative flex-1 flex flex-col items-center gap-1 py-2 rounded-xl"
              >
                {active && (
                  <motion.span
                    layoutId="user-nav-mobile-pill"
                    className="absolute inset-0 bg-accentsoft rounded-xl"
                    transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                  />
                )}
                <span className="relative flex flex-col items-center gap-1">
                  <FontAwesomeIcon
                    icon={link.icon}
                    className={clsx('w-4 h-4 transition-colors', active ? 'text-accent' : 'text-gray-500')}
                  />
                  <span
                    className={clsx(
                      'text-[10px] font-semibold transition-colors',
                      active ? 'text-accent' : 'text-gray-500'
                    )}
                  >
                    {link.label}
                  </span>
                </span>
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
