'use client';

import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { staggerContainer, fadeUpItem, sheetBackdrop, sheetPanel, hoverLift, tapScale } from '@/lib/motion';

type Asistente = {
  esTu: boolean;
  nombre: string;
  fotoUrl: string | null;
};

type Clase = {
  id: string;
  date: string;
  capacity: number;
  cancelled: boolean;
  _count: { bookings: number };
  asistentes: Asistente[];
  enEspera: number;
  miPosicionEspera: number | null;
};

type Reserva = {
  id: string;
  classSessionId: string;
  status: 'CONFIRMED' | 'CANCELLED_ON_TIME' | 'CANCELLED_LATE' | 'WAITLISTED';
  classSession: { date: string };
};

function mismodia(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

// Quita la parte de hora para poder comparar solo fechas ("¿es pasado?")
function soloFecha(d: Date) {
  const copia = new Date(d);
  copia.setHours(0, 0, 0, 0);
  return copia;
}

// Genera la cuadrícula de 6 semanas (42 días) que se ve en un calendario
// mensual normal, empezando siempre en lunes, incluyendo los días "de
// relleno" del mes anterior/siguiente para completar la cuadrícula.
function generarCuadriculaMes(mesReferencia: Date): Date[] {
  const primerDiaMes = new Date(mesReferencia.getFullYear(), mesReferencia.getMonth(), 1);
  const diaSemanaPrimer = primerDiaMes.getDay(); // 0 = domingo
  const offsetHastaLunes = diaSemanaPrimer === 0 ? 6 : diaSemanaPrimer - 1;

  const inicio = new Date(primerDiaMes);
  inicio.setDate(inicio.getDate() - offsetHastaLunes);

  const dias: Date[] = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(inicio);
    d.setDate(d.getDate() + i);
    dias.push(d);
  }
  return dias;
}

const NOMBRES_DIA = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

export default function MisClasesPage() {
  const [clases, setClases] = useState<Clase[]>([]);
  const [reservas, setReservas] = useState<Reserva[]>([]);
  const [mensaje, setMensaje] = useState('');
  const [procesando, setProcesando] = useState<string | null>(null);
  const [claseModalId, setClaseModalId] = useState<string | null>(null);

  const hoy = useMemo(() => soloFecha(new Date()), []);
  const [mesReferencia, setMesReferencia] = useState<Date>(
    new Date(hoy.getFullYear(), hoy.getMonth(), 1)
  );
  const [diaSeleccionado, setDiaSeleccionado] = useState<Date>(hoy);

  async function cargarDatos() {
    const [resClases, resReservas] = await Promise.all([
      fetch('/api/classes'),
      fetch('/api/bookings'),
    ]);
    setClases(await resClases.json());
    setReservas(await resReservas.json());
  }

  useEffect(() => {
    cargarDatos();
  }, []);

  function reservaConfirmadaPara(classSessionId: string) {
    return reservas.find(
      (r) => r.classSessionId === classSessionId && r.status === 'CONFIRMED'
    );
  }

  function reservaEnEsperaPara(classSessionId: string) {
    return reservas.find(
      (r) => r.classSessionId === classSessionId && r.status === 'WAITLISTED'
    );
  }

  // Para el puntito del calendario: ¿tiene el usuario alguna reserva
  // confirmada cuya clase caiga en este día concreto?
  function tieneReservaEseDia(dia: Date) {
    return reservas.some(
      (r) => r.status === 'CONFIRMED' && mismodia(new Date(r.classSession.date), dia)
    );
  }

  async function apuntarse(classSessionId: string) {
    setMensaje('');
    setProcesando(classSessionId);
    const res = await fetch('/api/bookings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ classSessionId }),
    });
    const data = await res.json();
    setProcesando(null);
    if (!res.ok) {
      setMensaje(data.error);
      return;
    }
    if (data.enListaDeEspera) {
      setMensaje('Clase completa: te hemos añadido a la lista de espera. Si se libera un hueco, entrarás automáticamente.');
    }
    cargarDatos();
  }

  async function salirDeEspera(bookingId: string) {
    setMensaje('');
    setProcesando(bookingId);
    const res = await fetch(`/api/bookings/${bookingId}`, { method: 'DELETE' });
    const data = await res.json();
    setProcesando(null);
    if (!res.ok) {
      setMensaje(data.error);
      return;
    }
    cargarDatos();
  }

  async function cancelar(bookingId: string) {
    setMensaje('');
    setProcesando(bookingId);
    const res = await fetch(`/api/bookings/${bookingId}`, { method: 'PATCH' });
    const data = await res.json();
    setProcesando(null);
    if (!res.ok) {
      setMensaje(data.error);
      return;
    }
    setMensaje(data.aviso);
    cargarDatos();
  }

  const diasCuadricula = useMemo(
    () => generarCuadriculaMes(mesReferencia),
    [mesReferencia]
  );

  function irMesAnterior() {
    const anterior = new Date(mesReferencia.getFullYear(), mesReferencia.getMonth() - 1, 1);
    // No dejamos navegar a meses ya pasados
    if (anterior.getFullYear() < hoy.getFullYear() ||
        (anterior.getFullYear() === hoy.getFullYear() && anterior.getMonth() < hoy.getMonth())) {
      return;
    }
    setMesReferencia(anterior);
  }

  function irMesSiguiente() {
    setMesReferencia(new Date(mesReferencia.getFullYear(), mesReferencia.getMonth() + 1, 1));
  }

  const esMesActual =
    mesReferencia.getFullYear() === hoy.getFullYear() &&
    mesReferencia.getMonth() === hoy.getMonth();

  const clasesDelDia = clases
    .filter((c) => !c.cancelled && mismodia(new Date(c.date), diaSeleccionado))
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  const franjas: { titulo: string; desde: number; hasta: number }[] = [
    { titulo: 'Mañana', desde: 0, hasta: 14 },
    { titulo: 'Tarde', desde: 14, hasta: 20 },
    { titulo: 'Noche', desde: 20, hasta: 24 },
  ];

  // Datos derivados de la clase que está abierta en el pop-up (si hay alguna)
  const claseModal = clases.find((c) => c.id === claseModalId) ?? null;
  const claseModalMiReserva = claseModal ? reservaConfirmadaPara(claseModal.id) : undefined;
  const claseModalMiEspera = claseModal ? reservaEnEsperaPara(claseModal.id) : undefined;
  const claseModalCompleta = claseModal ? claseModal._count.bookings >= claseModal.capacity : false;

  return (
    <div className="min-h-screen bg-page bg-gradient-hero bg-no-repeat pb-24">
      <div className="max-w-sm sm:max-w-xl mx-auto">
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="px-5 pt-6 pb-3"
      >
        <p className="text-accent text-[11px] font-semibold tracking-widest uppercase mb-1">
          Reservas
        </p>
        <h1 className="text-2xl font-extrabold tracking-tight">Elige tu clase</h1>
      </motion.div>

      <AnimatePresence>
        {mensaje && (
          <motion.div
            initial={{ opacity: 0, y: -8, height: 0 }}
            animate={{ opacity: 1, y: 0, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mx-5 mb-4 bg-accentsoft border border-accent/30 text-accent text-sm px-4 py-3 rounded-xl overflow-hidden"
          >
            {mensaje}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Cabecera del mes con navegación */}
      <div className="px-5 flex items-center justify-between mb-2">
        <button
          onClick={irMesAnterior}
          disabled={esMesActual}
          className="w-7 h-7 rounded-full bg-card flex items-center justify-center text-sm disabled:opacity-20 disabled:cursor-not-allowed hover:bg-cardhover"
          aria-label="Mes anterior"
        >
          ‹
        </button>
        <h2 className="font-bold text-sm capitalize">
          {mesReferencia.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })}
        </h2>
        <button
          onClick={irMesSiguiente}
          className="w-7 h-7 rounded-full bg-card flex items-center justify-center text-sm hover:bg-cardhover"
          aria-label="Mes siguiente"
        >
          ›
        </button>
      </div>

      {/* Cabecera de días de la semana */}
      <div className="px-5 grid grid-cols-7 gap-1 mb-1">
        {NOMBRES_DIA.map((n) => (
          <div key={n} className="text-center text-[10px] text-gray-500 font-semibold py-0.5">
            {n}
          </div>
        ))}
      </div>

      {/* Cuadrícula del calendario */}
      <div className="px-5 grid grid-cols-7 gap-1 mb-5 justify-items-center">
        {diasCuadricula.map((dia) => {
          const perteneceAlMes = dia.getMonth() === mesReferencia.getMonth();
          const esPasado = soloFecha(dia) < hoy;
          const esHoy = mismodia(dia, hoy);
          const seleccionado = mismodia(dia, diaSeleccionado);
          const tieneReserva = tieneReservaEseDia(dia);
          const deshabilitado = !perteneceAlMes || esPasado;

          return (
            <motion.button
              key={dia.toISOString()}
              disabled={deshabilitado}
              onClick={() => setDiaSeleccionado(dia)}
              whileTap={deshabilitado ? undefined : tapScale}
              className={`relative w-9 h-9 rounded-lg flex flex-col items-center justify-center text-xs font-semibold transition-colors
                ${deshabilitado ? 'text-gray-700 cursor-not-allowed' : seleccionado ? 'text-page' : 'text-gray-200 hover:bg-cardhover'}
                ${esHoy && !seleccionado ? 'ring-1 ring-accent/60' : ''}
              `}
            >
              {seleccionado && !deshabilitado && (
                <motion.span
                  layoutId="dia-seleccionado-pill"
                  className="absolute inset-0 bg-accent rounded-lg"
                  transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                />
              )}
              <span className="relative">{dia.getDate()}</span>
              {tieneReserva && (
                <span
                  className={`absolute bottom-1 w-1 h-1 rounded-full ${
                    seleccionado ? 'bg-page' : 'bg-accent'
                  }`}
                />
              )}
            </motion.button>
          );
        })}
      </div>

      {/* Franjas horarias del día elegido */}
      <div className="px-5 space-y-6">
        <h3 className="text-sm font-bold text-gray-300">
          {diaSeleccionado.toLocaleDateString('es-ES', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
          })}
        </h3>

        {clasesDelDia.length === 0 && (
          <p className="text-gray-500 text-sm py-6 text-center">
            No hay clases programadas este día.
          </p>
        )}

        {franjas.map((franja) => {
          const clasesFranja = clasesDelDia.filter((c) => {
            const h = new Date(c.date).getHours();
            return h >= franja.desde && h < franja.hasta;
          });

          if (clasesFranja.length === 0) return null;

          return (
            <div key={franja.titulo}>
              <h2 className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-2">
                {franja.titulo}
              </h2>
              <motion.div
                variants={staggerContainer}
                initial="hidden"
                animate="show"
                className="grid grid-cols-2 gap-3"
              >
                {clasesFranja.map((clase) => {
                  const miReserva = reservaConfirmadaPara(clase.id);
                  const miEspera = reservaEnEsperaPara(clase.id);
                  const ocupacion = clase._count.bookings / clase.capacity;
                  const completa = clase._count.bookings >= clase.capacity;
                  const plazasLibres = clase.capacity - clase._count.bookings;

                  return (
                    <motion.button
                      key={clase.id}
                      type="button"
                      variants={fadeUpItem}
                      whileHover={hoverLift}
                      whileTap={tapScale}
                      onClick={() => setClaseModalId(clase.id)}
                      className={`text-left w-full rounded-2xl p-4 flex flex-col gap-3 border transition-shadow
                        ${miReserva ? 'bg-accentsoft border-accent/40' : 'bg-card border-transparent hover:shadow-glow'}`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-lg font-bold">
                          {new Date(clase.date).toLocaleTimeString('es-ES', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                        {miReserva && (
                          <span className="text-accent text-[10px] font-bold bg-page/40 px-2 py-0.5 rounded-full">
                            APUNTADO
                          </span>
                        )}
                        {miEspera && (
                          <span className="text-gray-300 text-[10px] font-bold bg-page/40 px-2 py-0.5 rounded-full">
                            EN ESPERA
                          </span>
                        )}
                      </div>

                      <div>
                        <div className="h-1.5 w-full bg-page rounded-full overflow-hidden">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${Math.min(ocupacion * 100, 100)}%` }}
                            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                            className={`h-full rounded-full ${
                              completa ? 'bg-danger' : 'bg-accent'
                            }`}
                          />
                        </div>
                        <p className="text-[11px] text-gray-400 mt-1">
                          {completa
                            ? 'Completa'
                            : `${plazasLibres} plaza${plazasLibres === 1 ? '' : 's'} libre${plazasLibres === 1 ? '' : 's'}`}
                          {clase.enEspera > 0 &&
                            ` · ${clase.enEspera} en espera`}
                        </p>
                      </div>

                      <span className="text-[11px] text-accent font-semibold">
                        Ver detalles y participantes
                      </span>
                    </motion.button>
                  );
                })}
              </motion.div>
            </div>
          );
        })}
      </div>
      </div>

      <AnimatePresence>
        {claseModal && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
            <motion.div
              variants={sheetBackdrop}
              initial="hidden"
              animate="show"
              exit="exit"
              className="absolute inset-0 bg-black/60"
              onClick={() => setClaseModalId(null)}
            />
            <motion.div
              variants={sheetPanel}
              initial="hidden"
              animate="show"
              exit="exit"
              className="relative bg-card w-full sm:max-w-sm sm:rounded-3xl rounded-t-3xl p-5 max-h-[85vh] overflow-y-auto"
            >
            <div className="flex items-start justify-between mb-4">
              <div>
                <p className="text-accent text-[11px] font-semibold uppercase tracking-widest mb-1">
                  {new Date(claseModal.date).toLocaleDateString('es-ES', {
                    weekday: 'long',
                    day: 'numeric',
                    month: 'long',
                  })}
                </p>
                <h3 className="text-2xl font-extrabold">
                  {new Date(claseModal.date).toLocaleTimeString('es-ES', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </h3>
              </div>
              <button
                onClick={() => setClaseModalId(null)}
                aria-label="Cerrar"
                className="w-8 h-8 shrink-0 rounded-full bg-white/5 flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 text-lg leading-none"
              >
                ×
              </button>
            </div>

            <div className="mb-5">
              <div className="h-1.5 w-full bg-page rounded-full overflow-hidden mb-1.5">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{
                    width: `${Math.min((claseModal._count.bookings / claseModal.capacity) * 100, 100)}%`,
                  }}
                  transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                  className={`h-full rounded-full ${claseModalCompleta ? 'bg-danger' : 'bg-accent'}`}
                />
              </div>
              <p className="text-xs text-gray-400">
                {claseModal._count.bookings}/{claseModal.capacity} plazas ocupadas
                {claseModal.enEspera > 0 && ` · ${claseModal.enEspera} en espera`}
              </p>
            </div>

            <div className="mb-5">
              <p className="text-[11px] font-bold uppercase tracking-widest text-gray-500 mb-2">
                Apuntados
              </p>
              {claseModal.asistentes.length > 0 ? (
                <div className="space-y-2">
                  {claseModal.asistentes.map((asistente, i) => (
                    <div key={i} className="flex items-center gap-2.5 text-sm">
                      {asistente.fotoUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={asistente.fotoUrl}
                          alt=""
                          className="w-6 h-6 rounded-full object-cover shrink-0"
                        />
                      ) : (
                        <div
                          className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${
                            asistente.esTu ? 'bg-accent/15 text-accent' : 'bg-white/10 text-gray-300'
                          }`}
                        >
                          {asistente.esTu ? 'Tú' : asistente.nombre.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <span className={asistente.esTu ? 'text-gray-200 font-medium' : 'text-gray-300'}>
                        {asistente.esTu ? 'Tú' : asistente.nombre}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-gray-500">Aún no se ha apuntado nadie.</p>
              )}
            </div>

            {claseModalMiReserva ? (
              <div className="space-y-1.5">
                <button
                  onClick={() => cancelar(claseModalMiReserva.id)}
                  disabled={procesando === claseModalMiReserva.id}
                  className="w-full bg-dangersoft text-danger text-sm font-semibold py-2.5 rounded-xl hover:bg-danger/20 disabled:opacity-50"
                >
                  {procesando === claseModalMiReserva.id ? 'Cancelando...' : 'Cancelar reserva'}
                </button>
                <a
                  href={`/api/bookings/${claseModalMiReserva.id}/ics`}
                  download
                  className="block text-center text-[11px] text-gray-500 hover:text-accent py-1"
                >
                  Añadir al calendario
                </a>
              </div>
            ) : claseModalMiEspera ? (
              <div className="space-y-1.5">
                <div className="w-full bg-white/5 text-gray-300 text-xs font-semibold text-center py-2.5 rounded-xl">
                  En lista de espera
                  {claseModal.miPosicionEspera ? ` (posición ${claseModal.miPosicionEspera})` : ''}
                </div>
                <button
                  onClick={() => salirDeEspera(claseModalMiEspera.id)}
                  disabled={procesando === claseModalMiEspera.id}
                  className="w-full text-[11px] text-gray-500 hover:text-danger disabled:opacity-50 py-1"
                >
                  {procesando === claseModalMiEspera.id ? 'Saliendo...' : 'Salir de la lista'}
                </button>
              </div>
            ) : (
              <button
                onClick={() => apuntarse(claseModal.id)}
                disabled={procesando === claseModal.id}
                className={`w-full text-sm font-bold py-2.5 rounded-xl transition disabled:opacity-30 disabled:cursor-not-allowed ${
                  claseModalCompleta
                    ? 'bg-white/5 text-gray-200 hover:bg-white/10'
                    : 'bg-accent text-page hover:brightness-95'
                }`}
              >
                {procesando === claseModal.id
                  ? 'Apuntando...'
                  : claseModalCompleta
                  ? 'Unirme a la lista de espera'
                  : 'Apuntarme'}
              </button>
            )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}