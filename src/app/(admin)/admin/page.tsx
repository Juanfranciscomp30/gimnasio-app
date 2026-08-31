'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faDumbbell,
  faUsers,
  faCreditCard,
  faArrowUpRightFromSquare,
  faTriangleExclamation,
  faSackDollar,
} from '@fortawesome/free-solid-svg-icons';

type Resumen = {
  ingresosMes: number;
  totalUsuarios: number;
  cuotas: { vencidas: number; porVencer: number; sinPagos: number };
  bajasPendientes: { id: string; nombre: string }[];
  clasesHoy: { id: string; date: string; capacity: number; confirmados: number }[];
};

const secciones = [
  {
    href: '/admin/clases',
    icon: faDumbbell,
    titulo: 'Clases',
    descripcion: 'Calendario, aforo y asistentes',
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
  const [resumen, setResumen] = useState<Resumen | null>(null);

  useEffect(() => {
    fetch('/api/admin/dashboard')
      .then((res) => (res.ok ? res.json() : null))
      .then(setResumen);
  }, []);

  const cuotasProblema = resumen ? resumen.cuotas.vencidas + resumen.cuotas.sinPagos : 0;

  return (
    <div className="min-h-screen bg-page p-8">
      <div className="max-w-5xl mx-auto">
        <div className="mb-8">
          <p className="text-sm font-medium text-accent mb-1">
            {new Date().toLocaleDateString('es-ES', {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
            })}
          </p>
          <h1 className="text-3xl font-bold text-white">Panel de administración</h1>
        </div>

        {/* Alertas accionables */}
        {resumen && (cuotasProblema > 0 || resumen.bajasPendientes.length > 0) && (
          <div className="space-y-2 mb-6">
            {cuotasProblema > 0 && (
              <Link
                href="/admin/pagos"
                className="flex items-center gap-2.5 bg-dangersoft border border-danger/30 text-danger text-sm px-4 py-3 rounded-xl hover:bg-danger/20 transition-colors"
              >
                <FontAwesomeIcon icon={faTriangleExclamation} className="w-3.5 h-3.5 shrink-0" />
                <span>
                  {cuotasProblema} usuario{cuotasProblema === 1 ? '' : 's'} con la cuota vencida o
                  sin pagos registrados
                </span>
              </Link>
            )}
            {resumen.bajasPendientes.length > 0 && (
              <Link
                href="/admin/usuarios"
                className="flex items-center gap-2.5 bg-amber-400/10 border border-amber-400/30 text-amber-400 text-sm px-4 py-3 rounded-xl hover:bg-amber-400/15 transition-colors"
              >
                <FontAwesomeIcon icon={faTriangleExclamation} className="w-3.5 h-3.5 shrink-0" />
                <span>
                  {resumen.bajasPendientes.length} solicitud
                  {resumen.bajasPendientes.length === 1 ? '' : 'es'} de baja pendiente
                  {resumen.bajasPendientes.length === 1 ? '' : 's'}: {resumen.bajasPendientes.map((u) => u.nombre).join(', ')}
                </span>
              </Link>
            )}
          </div>
        )}

        {/* Métricas */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
          <div className="bg-card border border-white/5 rounded-2xl p-4">
            <div className="flex items-center gap-1.5 mb-2 text-gray-500">
              <FontAwesomeIcon icon={faSackDollar} className="w-3 h-3" />
              <p className="text-[11px] font-bold uppercase tracking-widest">Ingresos del mes</p>
            </div>
            <p className="text-2xl font-extrabold text-white">
              {resumen ? resumen.ingresosMes : '—'}
              {resumen && <span className="text-sm text-gray-500 font-semibold">€</span>}
            </p>
          </div>

          <div className="bg-card border border-white/5 rounded-2xl p-4">
            <div className="flex items-center gap-1.5 mb-2 text-gray-500">
              <FontAwesomeIcon icon={faUsers} className="w-3 h-3" />
              <p className="text-[11px] font-bold uppercase tracking-widest">Usuarios</p>
            </div>
            <p className="text-2xl font-extrabold text-white">{resumen ? resumen.totalUsuarios : '—'}</p>
          </div>

          <div className="bg-card border border-white/5 rounded-2xl p-4">
            <div className="flex items-center gap-1.5 mb-2 text-gray-500">
              <FontAwesomeIcon icon={faCreditCard} className="w-3 h-3" />
              <p className="text-[11px] font-bold uppercase tracking-widest">Cuotas vencidas</p>
            </div>
            <p className={`text-2xl font-extrabold ${resumen && resumen.cuotas.vencidas > 0 ? 'text-danger' : 'text-white'}`}>
              {resumen ? resumen.cuotas.vencidas : '—'}
            </p>
          </div>

          <div className="bg-card border border-white/5 rounded-2xl p-4">
            <div className="flex items-center gap-1.5 mb-2 text-gray-500">
              <FontAwesomeIcon icon={faCreditCard} className="w-3 h-3" />
              <p className="text-[11px] font-bold uppercase tracking-widest">Vencen pronto</p>
            </div>
            <p className={`text-2xl font-extrabold ${resumen && resumen.cuotas.porVencer > 0 ? 'text-amber-400' : 'text-white'}`}>
              {resumen ? resumen.cuotas.porVencer : '—'}
            </p>
          </div>
        </div>

        {/* Clases de hoy */}
        <div className="mb-8">
          <h2 className="text-sm font-bold text-gray-300 mb-3">Clases de hoy</h2>
          {resumen && resumen.clasesHoy.length === 0 && (
            <p className="text-gray-500 text-sm">No hay clases programadas hoy.</p>
          )}
          {resumen && resumen.clasesHoy.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {resumen.clasesHoy.map((c) => (
                <div key={c.id} className="bg-card border border-white/5 rounded-2xl p-4">
                  <p className="text-lg font-bold text-white mb-1">
                    {new Date(c.date).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                  </p>
                  <p className="text-xs text-gray-400">
                    {c.confirmados}/{c.capacity} plazas
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Accesos */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {secciones.map(({ href, icon, titulo, descripcion }) => (
            <Link
              key={href}
              href={href}
              className="group relative block p-6 bg-card border border-white/5 rounded-2xl transition-all duration-200 hover:border-accent/30 hover:-translate-y-0.5"
            >
              <div className="flex items-start justify-between mb-8">
                <div className="p-3 rounded-xl bg-accentsoft text-accent">
                  <FontAwesomeIcon icon={icon} className="w-5 h-5" />
                </div>
                <FontAwesomeIcon
                  icon={faArrowUpRightFromSquare}
                  className="w-4 h-4 text-gray-600 group-hover:text-accent transition-colors"
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
