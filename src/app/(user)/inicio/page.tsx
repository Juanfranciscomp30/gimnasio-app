'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { motion, AnimatePresence } from 'framer-motion';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faCalendarDays,
  faClock,
  faCreditCard,
  faTriangleExclamation,
  faCircleCheck,
  faDumbbell,
  faArrowRight,
  faBell,
  faXmark,
} from '@fortawesome/free-solid-svg-icons';
import { HORAS_LIMITE_CANCELACION } from '@/lib/booking-logic';
import { staggerContainer, fadeUpItem, hoverLift, tapScale } from '@/lib/motion';
import AnimatedNumber from '@/components/ui/AnimatedNumber';
import Skeleton from '@/components/ui/Skeleton';

type ProximaClase = {
  bookingId: string;
  classSessionId: string;
  date: string;
};

type Notificacion = {
  id: string;
  message: string;
  createdAt: string;
};

type Resumen = {
  nombre: string;
  weeklyPlan: 'ONE_DAY' | 'TWO_DAYS' | 'THREE_DAYS';
  cancellationRequested: boolean;
  proximasClases: ProximaClase[];
  usoSemanal: { usadas: number; limite: number };
  pago: { validUntil: string; vencido: boolean; venceProto: boolean } | null;
};

const ETIQUETA_PLAN: Record<Resumen['weeklyPlan'], string> = {
  ONE_DAY: '1 día/semana',
  TWO_DAYS: '2 días/semana',
  THREE_DAYS: '3 días/semana',
};

function soloFecha(d: Date) {
  const copia = new Date(d);
  copia.setHours(0, 0, 0, 0);
  return copia;
}

// "Hoy", "Mañana" o "lunes 8 sept." según lo cerca que esté la fecha
function etiquetaDia(fecha: Date, hoy: Date): string {
  const diffDias = Math.round((soloFecha(fecha).getTime() - hoy.getTime()) / 86400000);
  if (diffDias === 0) return 'Hoy';
  if (diffDias === 1) return 'Mañana';
  return fecha.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'short' });
}

// "en 2 horas", "en 3 días"... para dar sensación de cercanía real
function cuentaAtras(fecha: Date, ahora: Date): string {
  const msRestantes = fecha.getTime() - ahora.getTime();
  const horas = msRestantes / (1000 * 60 * 60);
  if (horas < 1) return `en ${Math.max(1, Math.round(msRestantes / 60000))} min`;
  if (horas < 24) return `en ${Math.round(horas)} h`;
  return `en ${Math.round(horas / 24)} días`;
}

function PantallaCarga() {
  return (
    <div className="min-h-screen bg-page">
      <div className="max-w-sm sm:max-w-3xl mx-auto px-5 pt-6 space-y-3">
        <Skeleton className="h-3 w-28" />
        <Skeleton className="h-7 w-40" />
        <Skeleton className="h-44 mt-2" />
        <div className="grid grid-cols-2 gap-3">
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
        </div>
      </div>
    </div>
  );
}

export default function InicioPage() {
  const { data: session } = useSession();
  const [resumen, setResumen] = useState<Resumen | null>(null);
  const [cargando, setCargando] = useState(true);
  const [notificaciones, setNotificaciones] = useState<Notificacion[]>([]);

  useEffect(() => {
    fetch('/api/dashboard')
      .then((res) => (res.ok ? res.json() : null))
      .then(setResumen)
      .finally(() => setCargando(false));

    fetch('/api/notifications')
      .then((res) => (res.ok ? res.json() : []))
      .then(setNotificaciones)
      .catch(() => {});
  }, []);

  // El usuario descarta el aviso: lo quitamos ya de la lista (sensación
  // instantánea) y en paralelo lo marcamos como leído en el servidor.
  async function descartarNotificacion(id: string) {
    setNotificaciones((actuales) => actuales.filter((n) => n.id !== id));
    fetch(`/api/notifications/${id}`, { method: 'PATCH' }).catch(() => {});
  }

  const ahora = new Date();
  const hoy = soloFecha(ahora);
  const nombrePila = (resumen?.nombre ?? session?.user?.name ?? '').split(' ')[0];

  if (cargando) {
    return <PantallaCarga />;
  }

  if (!resumen) {
    return (
      <div className="min-h-screen bg-page flex items-center justify-center text-gray-400 text-sm">
        No se ha podido cargar tu panel.
      </div>
    );
  }

  const [proximaClase, ...siguientes] = resumen.proximasClases;
  const horasHastaProxima = proximaClase
    ? (new Date(proximaClase.date).getTime() - ahora.getTime()) / 3600000
    : null;
  const claseMuyCerca = horasHastaProxima !== null && horasHastaProxima < HORAS_LIMITE_CANCELACION;
  const ocupacionSemanal = Math.min(
    resumen.usoSemanal.usadas / resumen.usoSemanal.limite,
    1
  );
  const semanaCompleta = resumen.usoSemanal.usadas >= resumen.usoSemanal.limite;

  let estadoPago: { texto: string; detalle: string; tono: 'ok' | 'aviso' | 'mal' };
  if (!resumen.pago) {
    estadoPago = { texto: 'Sin pagos', detalle: 'Contacta con el gimnasio para activar tu cuota.', tono: 'mal' };
  } else if (resumen.pago.vencido) {
    estadoPago = {
      texto: 'Vencida',
      detalle: `Venció el ${new Date(resumen.pago.validUntil).toLocaleDateString('es-ES')}`,
      tono: 'mal',
    };
  } else if (resumen.pago.venceProto) {
    estadoPago = {
      texto: 'Vence pronto',
      detalle: `Hasta el ${new Date(resumen.pago.validUntil).toLocaleDateString('es-ES')}`,
      tono: 'aviso',
    };
  } else {
    estadoPago = {
      texto: 'Al día',
      detalle: `Hasta el ${new Date(resumen.pago.validUntil).toLocaleDateString('es-ES')}`,
      tono: 'ok',
    };
  }

  const estiloTono: Record<typeof estadoPago.tono, string> = {
    ok: 'text-accent bg-accentsoft',
    aviso: 'text-amber-400 bg-amber-400/10',
    mal: 'text-danger bg-dangersoft',
  };

  return (
    <div className="min-h-screen bg-page bg-gradient-hero bg-no-repeat pb-24">
      <motion.div
        variants={staggerContainer}
        initial="hidden"
        animate="show"
        className="max-w-sm sm:max-w-3xl mx-auto px-5 pt-6 lg:grid lg:grid-cols-5 lg:gap-6 lg:items-start"
      >
        <div className="lg:col-span-3">
          <motion.p variants={fadeUpItem} className="text-accent text-[11px] font-semibold tracking-widest uppercase mb-1">
            {hoy.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}
          </motion.p>
          <motion.h1 variants={fadeUpItem} className="text-2xl sm:text-3xl font-extrabold mb-5 tracking-tight">
            Hola{nombrePila ? `, ${nombrePila}` : ''} <span className="inline-block">💪</span>
          </motion.h1>

          <AnimatePresence initial={false}>
            {notificaciones.map((n) => (
              <motion.div
                key={n.id}
                layout
                initial={{ opacity: 0, y: -10, height: 0, marginBottom: 0 }}
                animate={{ opacity: 1, y: 0, height: 'auto', marginBottom: 8 }}
                exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                transition={{ duration: 0.25 }}
                className="bg-accentsoft border border-accent/30 text-sm px-4 py-3 rounded-xl flex items-start gap-2 overflow-hidden"
              >
                <FontAwesomeIcon icon={faBell} className="w-3.5 h-3.5 mt-0.5 shrink-0 text-accent" />
                <span className="flex-1 text-gray-200">{n.message}</span>
                <button
                  onClick={() => descartarNotificacion(n.id)}
                  className="text-gray-500 hover:text-gray-300 shrink-0"
                  aria-label="Descartar aviso"
                >
                  <FontAwesomeIcon icon={faXmark} className="w-3.5 h-3.5" />
                </button>
              </motion.div>
            ))}
          </AnimatePresence>

          {resumen.cancellationRequested && (
            <motion.div
              variants={fadeUpItem}
              className="mb-4 bg-dangersoft border border-danger/30 text-danger text-sm px-4 py-3 rounded-xl flex items-start gap-2"
            >
              <FontAwesomeIcon icon={faTriangleExclamation} className="w-3.5 h-3.5 mt-0.5 shrink-0" />
              <span>Has solicitado la baja. No puedes reservar clases nuevas mientras esté pendiente de revisión.</span>
            </motion.div>
          )}

          {estadoPago.tono !== 'ok' && (
            <motion.div
              variants={fadeUpItem}
              className={`mb-4 border text-sm px-4 py-3 rounded-xl flex items-start gap-2 ${
                estadoPago.tono === 'mal'
                  ? 'bg-dangersoft border-danger/30 text-danger'
                  : 'bg-amber-400/10 border-amber-400/30 text-amber-400'
              }`}
            >
              <FontAwesomeIcon icon={faCreditCard} className="w-3.5 h-3.5 mt-0.5 shrink-0" />
              <span>
                {!resumen.pago && 'No tienes ningún pago registrado. Contacta con el gimnasio para activar tu cuota.'}
                {resumen.pago?.vencido &&
                  `Tu cuota está vencida desde el ${new Date(resumen.pago.validUntil).toLocaleDateString('es-ES')}. Contacta con el gimnasio para renovarla.`}
                {resumen.pago?.venceProto &&
                  `Tu cuota vence pronto, el ${new Date(resumen.pago.validUntil).toLocaleDateString('es-ES')}.`}
              </span>
            </motion.div>
          )}

          {/* Próxima clase — la pieza principal de la página */}
          {proximaClase ? (
            <motion.div
              variants={fadeUpItem}
              whileHover={hoverLift}
              className={`relative overflow-hidden bg-card bg-gradient-card-glow rounded-2xl p-5 mb-3 border transition-shadow ${
                claseMuyCerca ? 'border-amber-400/40' : 'border-accent/20 hover:shadow-glow'
              }`}
            >
              <Link href="/mis-clases" className="block">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-[11px] font-bold uppercase tracking-widest text-accent">
                    Tu próxima clase
                  </p>
                  <span
                    className={`text-[11px] px-2 py-0.5 rounded-full ${
                      claseMuyCerca
                        ? 'text-amber-400 font-bold bg-amber-400/10 animate-pulse-glow'
                        : 'text-gray-400 font-semibold bg-white/5'
                    }`}
                  >
                    {cuentaAtras(new Date(proximaClase.date), ahora)}
                  </span>
                </div>
                <div className="flex items-end justify-between">
                  <div>
                    <p className="text-4xl font-extrabold text-white leading-none mb-1.5 tabular-nums">
                      {new Date(proximaClase.date).toLocaleTimeString('es-ES', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                    <p className="text-sm text-gray-400 capitalize">
                      {etiquetaDia(new Date(proximaClase.date), hoy)}
                    </p>
                  </div>
                  <motion.span whileHover={{ x: 3 }} className="text-gray-600">
                    <FontAwesomeIcon icon={faArrowRight} className="w-4 h-4" />
                  </motion.span>
                </div>
                {claseMuyCerca && (
                  <p className="text-[11px] text-amber-400 mt-2 flex items-center gap-1.5">
                    <FontAwesomeIcon icon={faTriangleExclamation} className="w-2.5 h-2.5" />
                    Si cancelas ahora ya cuenta como tardío: perderías el día.
                  </p>
                )}
              </Link>
              <a
                href={`/api/bookings/${proximaClase.bookingId}/ics`}
                download
                className="block text-center text-[11px] text-gray-500 hover:text-accent mt-3 pt-3 border-t border-white/5 transition-colors"
              >
                Añadir al calendario
              </a>
            </motion.div>
          ) : (
            <motion.div variants={fadeUpItem} whileHover={hoverLift} whileTap={tapScale}>
              <Link
                href="/mis-clases"
                className="block bg-card hover:bg-cardhover transition-colors rounded-2xl p-8 mb-3 text-center"
              >
                <FontAwesomeIcon icon={faDumbbell} className="w-7 h-7 text-accent mb-3 animate-float" />
                <p className="text-sm font-semibold text-gray-200 mb-1">Aún no tienes clases reservadas</p>
                <p className="text-xs text-accent font-semibold">
                  Reservar una clase <FontAwesomeIcon icon={faArrowRight} className="w-2.5 h-2.5 ml-0.5" />
                </p>
              </Link>
            </motion.div>
          )}

          {/* Siguientes clases (si hay más de una) */}
          {siguientes.length > 0 && (
            <motion.div variants={fadeUpItem} className="bg-card rounded-2xl p-4 mb-3 space-y-2.5">
              <p className="text-[11px] font-bold uppercase tracking-widest text-gray-500 mb-1">
                Después de esta
              </p>
              {siguientes.map((c) => (
                <div key={c.bookingId} className="flex items-center gap-2.5 text-sm">
                  <FontAwesomeIcon icon={faCalendarDays} className="w-3 h-3 text-gray-600" />
                  <span className="text-gray-300 capitalize">{etiquetaDia(new Date(c.date), hoy)}</span>
                  <span className="text-gray-500">·</span>
                  <span className="text-gray-400">
                    {new Date(c.date).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              ))}
            </motion.div>
          )}
        </div>

        <div className="lg:col-span-2">
          {/* Uso semanal + membresía */}
          <div className="grid grid-cols-2 lg:grid-cols-1 gap-3 mb-3">
            <motion.div variants={fadeUpItem} whileHover={hoverLift} className="bg-card rounded-2xl p-4">
              <div className="flex items-center gap-1.5 mb-2">
                <FontAwesomeIcon icon={faClock} className="w-3 h-3 text-gray-500" />
                <p className="text-[11px] font-bold uppercase tracking-widest text-gray-500">Esta semana</p>
              </div>
              <p className="text-lg font-extrabold mb-1.5 tabular-nums">
                <AnimatedNumber value={resumen.usoSemanal.usadas} />
                <span className="text-gray-500 text-sm font-semibold"> / {resumen.usoSemanal.limite}</span>
              </p>
              <div className="h-1.5 w-full bg-page rounded-full overflow-hidden mb-1">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${ocupacionSemanal * 100}%` }}
                  transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1], delay: 0.15 }}
                  className={`h-full rounded-full ${semanaCompleta ? 'bg-danger' : 'bg-accent'}`}
                />
              </div>
              <p className="text-[11px] text-gray-500">{ETIQUETA_PLAN[resumen.weeklyPlan]}</p>
            </motion.div>

            <motion.div variants={fadeUpItem} whileHover={hoverLift} className="bg-card rounded-2xl p-4">
              <div className="flex items-center gap-1.5 mb-2">
                <FontAwesomeIcon icon={faCreditCard} className="w-3 h-3 text-gray-500" />
                <p className="text-[11px] font-bold uppercase tracking-widest text-gray-500">Pagos</p>
              </div>
              <span
                className={`inline-flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-full mb-1.5 ${estiloTono[estadoPago.tono]}`}
              >
                <FontAwesomeIcon
                  icon={estadoPago.tono === 'ok' ? faCircleCheck : faTriangleExclamation}
                  className="w-2.5 h-2.5"
                />
                {estadoPago.texto}
              </span>
              <p className="text-[11px] text-gray-500 leading-snug">{estadoPago.detalle}</p>
            </motion.div>
          </div>

          {/* Accesos rápidos */}
          <motion.div variants={fadeUpItem} className="flex gap-3 lg:flex-col">
            <motion.div whileHover={hoverLift} whileTap={tapScale} className="flex-1">
              <Link
                href="/mis-clases"
                className="block bg-gradient-accent text-page text-sm font-bold text-center py-2.5 rounded-xl shadow-glow"
              >
                Reservar clase
              </Link>
            </motion.div>
            <motion.div whileHover={hoverLift} whileTap={tapScale} className="flex-1">
              <Link
                href="/perfil"
                className="block bg-white/5 hover:bg-white/10 transition-colors text-gray-200 text-sm font-semibold text-center py-2.5 rounded-xl"
              >
                Mi perfil
              </Link>
            </motion.div>
          </motion.div>
        </div>
      </motion.div>
    </div>
  );
}
