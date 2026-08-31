'use client';

import { useEffect, useMemo, useState } from 'react';

type Clase = {
  id: string;
  date: string;
  capacity: number;
  _count: { bookings: number };
};

type Reserva = {
  id: string;
  classSessionId: string;
  status: 'CONFIRMED' | 'CANCELLED_ON_TIME' | 'CANCELLED_LATE';
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
    .filter((c) => mismodia(new Date(c.date), diaSeleccionado))
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  const franjas: { titulo: string; desde: number; hasta: number }[] = [
    { titulo: 'Mañana', desde: 0, hasta: 14 },
    { titulo: 'Tarde', desde: 14, hasta: 20 },
    { titulo: 'Noche', desde: 20, hasta: 24 },
  ];

  return (
    <div className="min-h-screen bg-page pb-24">
      <div className="max-w-sm mx-auto">
      <div className="px-5 pt-6 pb-3">
        <p className="text-accent text-[11px] font-semibold tracking-widest uppercase mb-1">
          Reservas
        </p>
        <h1 className="text-xl font-extrabold">Elige tu clase</h1>
      </div>

      {mensaje && (
        <div className="mx-5 mb-4 bg-accentsoft border border-accent/30 text-accent text-sm px-4 py-3 rounded-xl">
          {mensaje}
        </div>
      )}

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
            <button
              key={dia.toISOString()}
              disabled={deshabilitado}
              onClick={() => setDiaSeleccionado(dia)}
              className={`relative w-9 h-9 rounded-lg flex flex-col items-center justify-center text-xs font-semibold transition
                ${deshabilitado ? 'text-gray-700 cursor-not-allowed' : 'text-gray-200 hover:bg-cardhover'}
                ${seleccionado && !deshabilitado ? 'bg-accent text-page' : ''}
                ${esHoy && !seleccionado ? 'ring-1 ring-accent/60' : ''}
              `}
            >
              {dia.getDate()}
              {tieneReserva && (
                <span
                  className={`absolute bottom-1 w-1 h-1 rounded-full ${
                    seleccionado ? 'bg-page' : 'bg-accent'
                  }`}
                />
              )}
            </button>
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
              <div className="grid grid-cols-2 gap-3">
                {clasesFranja.map((clase) => {
                  const miReserva = reservaConfirmadaPara(clase.id);
                  const ocupacion = clase._count.bookings / clase.capacity;
                  const completa = clase._count.bookings >= clase.capacity;
                  const plazasLibres = clase.capacity - clase._count.bookings;

                  return (
                    <div
                      key={clase.id}
                      className={`rounded-2xl p-4 flex flex-col gap-3 border transition
                        ${miReserva ? 'bg-accentsoft border-accent/40' : 'bg-card border-transparent'}`}
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
                      </div>

                      <div>
                        <div className="h-1.5 w-full bg-page rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              completa ? 'bg-danger' : 'bg-accent'
                            }`}
                            style={{ width: `${Math.min(ocupacion * 100, 100)}%` }}
                          />
                        </div>
                        <p className="text-[11px] text-gray-400 mt-1">
                          {completa
                            ? 'Completa'
                            : `${plazasLibres} plaza${plazasLibres === 1 ? '' : 's'} libre${plazasLibres === 1 ? '' : 's'}`}
                        </p>
                      </div>

                      {miReserva ? (
                        <button
                          onClick={() => cancelar(miReserva.id)}
                          disabled={procesando === miReserva.id}
                          className="w-full bg-dangersoft text-danger text-sm font-semibold py-2 rounded-xl hover:bg-danger/20 disabled:opacity-50"
                        >
                          {procesando === miReserva.id ? 'Cancelando...' : 'Cancelar'}
                        </button>
                      ) : (
                        <button
                          onClick={() => apuntarse(clase.id)}
                          disabled={completa || procesando === clase.id}
                          className="w-full bg-accent text-page text-sm font-bold py-2 rounded-xl hover:brightness-95 disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                          {completa
                            ? 'Completa'
                            : procesando === clase.id
                            ? 'Apuntando...'
                            : 'Apuntarme'}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
      </div>
    </div>
  );
}