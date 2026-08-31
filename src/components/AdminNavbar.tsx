'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut, useSession } from 'next-auth/react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faRightFromBracket } from '@fortawesome/free-solid-svg-icons';
import clsx from 'clsx';

const links = [
  { href: '/admin', label: 'Inicio' },
  { href: '/admin/clases', label: 'Clases' },
  { href: '/admin/usuarios', label: 'Usuarios' },
  { href: '/admin/pagos', label: 'Pagos' },
];

export default function AdminNavbar() {
  const { data: session } = useSession();
  const pathname = usePathname();
  const inicial = session?.user?.name?.charAt(0).toUpperCase() ?? 'A';

  return (
    <nav className="bg-[#0F1115] border-b border-white/5 px-6 py-3 flex items-center justify-between">
      <div className="flex items-center gap-8">
        <span className="font-bold text-white tracking-tight">
          Gimnasio <span className="text-[#C6F135]">· Admin</span>
        </span>
        <div className="flex items-center gap-1">
          {links.map((link) => {
            const active = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={clsx(
                  'text-sm px-3 py-1.5 rounded-lg transition-colors',
                  active
                    ? 'bg-[#C6F135]/10 text-[#C6F135] font-medium'
                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                )}
              >
                {link.label}
              </Link>
            );
          })}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-full bg-[#C6F135]/15 text-[#C6F135] flex items-center justify-center text-xs font-semibold">
            {inicial}
          </div>
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