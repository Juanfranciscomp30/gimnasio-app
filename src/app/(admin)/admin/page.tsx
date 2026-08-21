import Link from 'next/link';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faDumbbell,
  faUsers,
  faCreditCard,
  faArrowUpRightFromSquare,
} from '@fortawesome/free-solid-svg-icons';

const secciones = [
  {
    href: '/admin/clases',
    icon: faDumbbell,
    titulo: 'Clases',
    descripcion: 'Ver aforo y asistentes por día',
  },
  {
    href: '/admin/usuarios',
    icon: faUsers,
    titulo: 'Usuarios',
    descripcion: 'Gestionar tarifas y alta manual',
  },
  {
    href: '/admin/pagos',
    icon: faCreditCard,
    titulo: 'Pagos',
    descripcion: 'Registrar y consultar pagos',
  },
];

export default function AdminHomePage() {
  return (
    <div className="min-h-screen bg-[#0F1115] p-8">
      <div className="max-w-5xl mx-auto">
        <div className="mb-10">
          <p className="text-sm font-medium text-[#C6F135] mb-1">Panel de administración</p>
          <h1 className="text-3xl font-bold text-white">¿Qué quieres gestionar hoy?</h1>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {secciones.map(({ href, icon, titulo, descripcion }) => (
            <Link
              key={href}
              href={href}
              className="group relative block p-6 bg-[#1A1D23] border border-white/5 rounded-2xl transition-all duration-200 hover:border-[#C6F135]/30 hover:-translate-y-0.5"
            >
              <div className="flex items-start justify-between mb-8">
                <div className="p-3 rounded-xl bg-[#C6F135]/10 text-[#C6F135]">
                  <FontAwesomeIcon icon={icon} className="w-5 h-5" />
                </div>
                <FontAwesomeIcon
                  icon={faArrowUpRightFromSquare}
                  className="w-4 h-4 text-gray-600 group-hover:text-[#C6F135] transition-colors"
                />
              </div>

              <h2 className="font-semibold text-white mb-1">{titulo}</h2>
              <p className="text-sm text-gray-400">{descripcion}</p>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}