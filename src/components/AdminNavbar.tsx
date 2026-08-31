'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut, useSession } from 'next-auth/react';
import { motion } from 'framer-motion';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faRightFromBracket,
  faGaugeHigh,
  faDumbbell,
  faUsers,
  faCreditCard,
} from '@fortawesome/free-solid-svg-icons';
import clsx from 'clsx';

const links = [
  { href: '/admin', label: 'Inicio', icon: faGaugeHigh },
  { href: '/admin/clases', label: 'Clases', icon: faDumbbell },
  { href: '/admin/usuarios', label: 'Usuarios', icon: faUsers },
  { href: '/admin/pagos', label: 'Pagos', icon: faCreditCard },
];

export default function AdminNavbar() {
  const { data: session } = useSession();
  const pathname = usePathname();
  const inicial = session?.user?.name?.charAt(0).toUpperCase() ?? 'A';

  return (
    <div className="sticky top-3 z-30 px-3 sm:px-6">
      <nav className="max-w-5xl mx-auto bg-card/90 backdrop-blur-md border border-white/10 rounded-2xl shadow-card px-3 sm:px-4 py-2 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 sm:gap-6 min-w-0">
          <Link href="/admin" className="flex items-center gap-2 shrink-0">
            <span className="w-8 h-8 rounded-xl bg-gradient-accent flex items-center justify-center shadow-glow">
              <FontAwesomeIcon icon={faDumbbell} className="w-3.5 h-3.5 text-page" />
            </span>
            <span className="font-extrabold text-white tracking-tight hidden sm:inline">
              Admin
            </span>
          </Link>
          <div className="flex items-center gap-1 overflow-x-auto scrollbar-hide">
            {links.map((link) => {
              const active = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={clsx(
                    'relative flex items-center gap-2 text-sm px-3 py-1.5 rounded-xl font-medium whitespace-nowrap transition-colors',
                    active ? 'text-accent' : 'text-gray-400 hover:text-white'
                  )}
                >
                  {active && (
                    <motion.span
                      layoutId="admin-nav-pill"
                      className="absolute inset-0 bg-accentsoft rounded-xl"
                      transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                    />
                  )}
                  <FontAwesomeIcon icon={link.icon} className="relative w-3 h-3" />
                  <span className="relative inline">{link.label}</span>
                </Link>
              );
            })}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <div className="hidden sm:flex w-8 h-8 rounded-full bg-accentsoft text-accent items-center justify-center text-xs font-bold ring-2 ring-accent/20">
            {inicial}
          </div>
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
  );
}
