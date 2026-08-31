'use client';

import { useEffect, useMemo, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faRepeat, faPlus, faMinus } from '@fortawesome/free-solid-svg-icons';
import clsx from 'clsx';

type ClaseResumen = {
  id: string;
  date: string;
  capacity: number;
  cancelled: boolean;
  _count: { bookings: number };
  enEspera: number;
};

type BookingDetalle = {
  id: string;
  status: 'CONFIRMED' | 'CANCELLED_ON_TIME' | 'CANCELLED_LATE' | 'WAITLISTED';
  user: { id: string; name: string; email: string; profileImageUrl: string | null };
};

type ClaseDetalle = ClaseResumen & { bookings: BookingDetalle[] };

const DIAS_SEMANA = [
  { valor: 1, etiqueta: 'L' },
  { valor: 2, etiqueta: 'M' },
  { valor: 3, etiqueta: 'X' },
  { valor: 4, etiqueta: 'J' },
  { valor: 5, etiqueta: 'V' },
  { valor: 6, etiqueta: 'S' },
  { valor: 0, etiqueta: 'D' },
];

const ETIQUETA_ESTADO: Record<BookingDetalle['status'], string> = {
  CONFIRMED: 'Asistió',
  CANCELLED_LATE: 'Canceló tarde',
  CANCELLED_ON_TIME: 'Canceló a tiempo',
  WAITLISTED: 'Lista de espera',
};

const ESTILO_ESTADO: Record<BookingDetalle['status'], string> = {
  CONFIRMED: 'bg-accentsoft text-accent border-accent/20',
  CANCELLED_LATE: 'bg-dangersoft text-danger border-danger/20',
  CANCELLED_ON_TIME: 'bg-white/5 text-gray-400 border-white/10',
  WAITLISTED: 'bg-amber-400/10 text-amber-400 border-amber-400/20',
};

function mismodia(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function soloFecha(d: Date) {
  const copia = new Date(d);
  copia.setHours(0, 0, 0, 0);
  return copia;
}

function generarCuadriculaMes(mesReferencia: Date): Date[] {
  const primerDiaMes = new Date(mesReferencia.getFullYear(), mesReferencia.getMonth(), 1);
  const diaSemanaPrimer = primerDiaMes.getDay();
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

export default function ClasesAdminPage() {
  const [clases, setClases] = useState<ClaseResumen[]>([]);

  const hoy = useMemo(() => soloFecha(new Date()), []);
  const [mesReferencia, setMesReferencia] = useState<Date>(
    new Date(hoy.getFullYear(), hoy.getMonth(), 1)
  );
  const [diaSeleccionado, setDiaSeleccionado] = useState<Date>(hoy);

  // Formulario de creación (colapsado por defecto para no saturar la vista)
  const [mostrarForm, setMostrarForm] = useState(false);
  const [esRecurrente, setEsRecurrente] = useState(false);
  const [fecha, setFecha] = useState('');
  const [hora, setHora] = useState('');
  const [capacidad, setCapacidad] = useState(10);
  const [diasSeleccionados, setDiasSeleccionados] = useState<number[]>([]);
  const [modoFin, setModoFin] = useState<'date' | 'weeks'>('weeks');
  const [fechaFin, setFechaFin] = useState('');
  const [semanas, setSemanas] = useState(8);
  const [error, setError] = useState('');
  const [mensajeExito, setMensajeExito] = useState('');
  const [cargando, setCargando] = useState(false);

  // Pop-up de detalle / edición / cancelación
  const [claseModalId, setClaseModalId] = useState<string | null>(null);
  const [detalle, setDetalle] = useState<ClaseDetalle | null>(null);
  const [cargandoDetalle, setCargandoDetalle] = useState(false);
  const [editCapacidad, setEditCapacidad] = useState(0);
  const [editFecha, setEditFecha] = useState('');
  const [editHora, setEditHora] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [confirmandoCancelar, setConfirmandoCancelar] = useState(false);
  const [cancelando, setCancelando] = useState(false);
  const [errorModal, setErrorModal] = useState('');

  async function cargarClases() {
    const res = await fetch('/api/classes');
    if (res.ok) setClases(await res.json());
  }

  useEffect(() => {
    cargarClases();
  }, []);

  function toggleDia(dia: number) {
    setDiasSeleccionados((prev) =>
      prev.includes(dia) ? prev.filter((d) => d !== dia) : [...prev, dia]
    );
  }

  async function handleCrearClase(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setMensajeExito('');
    setCargando(true);

    const body = esRecurrente
      ? {
          recurring: true,
          daysOfWeek: diasSeleccionados,
          time: hora,
          capacity: Number(capacidad),
          startDate: fecha,
          endMode: modoFin,
          ...(modoFin === 'date' ? { endDate: fechaFin } : { weeks: Number(semanas) }),
        }
      : {
          date: new Date(`${fecha}T${hora}:00`).toISOString(),
          capacity: Number(capacidad),
        };

    const res = await fetch('/api/classes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const data = await res.json();
    setCargando(false);

    if (!res.ok) {
      setError(data.error || 'Error al crear la clase');
      return;
    }

    setMensajeExito(esRecurrente ? `Se han creado ${data.creadas} clases.` : 'Clase creada correctamente.');
    setFecha('');
    setHora('');
    setCapacidad(10);
    setDiasSeleccionados([]);
    setFechaFin('');
    cargarClases();
  }

  async function abrirModal(id: string) {
    setClaseModalId(id);
    setErrorModal('');
    setConfirmandoCancelar(false);
    setCargandoDetalle(true);
    const res = await fetch(`/api/classes/${id}`);
    const data: ClaseDetalle = await res.json();
    setDetalle(data);
    setEditCapacidad(data.capacity);
    const d = new Date(data.date);
    setEditFecha(d.toISOString().slice(0, 10));
    setEditHora(d.toTimeString().slice(0, 5));
    setCargandoDetalle(false);
  }

  function cerrarModal() {
    setClaseModalId(null);
    setDetalle(null);
    setConfirmandoCancelar(false);
    setErrorModal('');
  }

  async function guardarEdicion() {
    if (!detalle) return;
    setErrorModal('');
    setGuardando(true);
    const res = await fetch(`/api/classes/${detalle.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        capacity: Number(editCapacidad),
        date: new Date(`${editFecha}T${editHora}:00`).toISOString(),
      }),
    });
    const data = await res.json();
    setGuardando(false);
    if (!res.ok) {
      setErrorModal(data.error);
      return;
    }
    await abrirModal(detalle.id);
    cargarClases();
  }

  async function confirmarCancelacion() {
    if (!detalle) return;
    setErrorModal('');
    setCancelando(true);
    const res = await fetch(`/api/classes/${detalle.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accion: 'cancelar' }),
    });
    const data = await res.json();
    setCancelando(false);
    if (!res.ok) {
      setErrorModal(data.error);
      return;
    }
    await abrirModal(detalle.id);
    cargarClases();
  }

  const diasCuadricula = useMemo(() => generarCuadriculaMes(mesReferencia), [mesReferencia]);

  function irMesAnterior() {
    setMesReferencia(new Date(mesReferencia.getFullYear(), mesReferencia.getMonth() - 1, 1));
  }
  function irMesSiguiente() {
    setMesReferencia(new Date(mesReferencia.getFullYear(), mesReferencia.getMonth() + 1, 1));
  }

  function tieneClaseEseDia(dia: Date) {
    return clases.some((c) => mismodia(new Date(c.date), dia));
  }

  const clasesDelDia = clases
    .filter((c) => mismodia(new Date(c.date), diaSeleccionado))
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  return (
    <div className="min-h-screen bg-page p-8">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-white">Clases</h1>
          <button
            onClick={() => setMostrarForm((v) => !v)}
            className={clsx(
              'flex items-center gap-2 text-sm font-semibold px-4 py-2 rounded-xl transition-colors',
              mostrarForm ? 'bg-white/5 text-gray-300 hover:bg-white/10' : 'bg-accent text-page hover:brightness-95'
            )}
          >
            <FontAwesomeIcon icon={mostrarForm ? faMinus : faPlus} className="w-3 h-3" />
            {mostrarForm ? 'Cerrar' : 'Nueva clase'}
          </button>
        </div>

        {mostrarForm && (
          <form
            onSubmit={handleCrearClase}
            className="bg-card border border-white/5 p-6 rounded-2xl shadow-sm mb-8 space-y-4"
          >
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-white">Crear nueva clase</h2>
              <button
                type="button"
                onClick={() => setEsRecurrente((v) => !v)}
                className={clsx(
                  'flex items-center gap-2 text-xs font-medium px-3 py-1.5 rounded-lg transition-colors',
                  esRecurrente ? 'bg-accentsoft text-accent' : 'bg-white/5 text-gray-400 hover:text-white'
                )}
              >
                <FontAwesomeIcon icon={faRepeat} className="w-3 h-3" />
                Recurrente
              </button>
            </div>

            {error && (
              <p className="text-danger text-sm bg-dangersoft border border-danger/20 p-2 rounded-xl">
                {error}
              </p>
            )}
            {mensajeExito && (
              <p className="text-accent text-sm bg-accentsoft border border-accent/20 p-2 rounded-xl">
                {mensajeExito}
              </p>
            )}

            {esRecurrente && (
              <div>
                <label className="block text-sm font-medium mb-2 text-gray-300">Días</label>
                <div className="flex gap-2">
                  {DIAS_SEMANA.map(({ valor, etiqueta }) => (
                    <button
                      key={valor}
                      type="button"
                      onClick={() => toggleDia(valor)}
                      className={clsx(
                        'w-9 h-9 rounded-lg text-sm font-medium transition-colors',
                        diasSeleccionados.includes(valor)
                          ? 'bg-accent text-page'
                          : 'bg-page border border-white/10 text-gray-400 hover:text-white'
                      )}
                    >
                      {etiqueta}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="flex gap-4">
              <div className="flex-1">
                <label className="block text-sm font-medium mb-1 text-gray-300">
                  {esRecurrente ? 'Empieza el' : 'Fecha'}
                </label>
                <input
                  type="date"
                  value={fecha}
                  onChange={(e) => setFecha(e.target.value)}
                  required
                  className="w-full bg-page border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent/50"
                />
              </div>
              <div className="flex-1">
                <label className="block text-sm font-medium mb-1 text-gray-300">Hora</label>
                <input
                  type="time"
                  value={hora}
                  onChange={(e) => setHora(e.target.value)}
                  required
                  className="w-full bg-page border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent/50"
                />
              </div>
              <div className="w-28">
                <label className="block text-sm font-medium mb-1 text-gray-300">Aforo</label>
                <input
                  type="number"
                  min={1}
                  value={capacidad}
                  onChange={(e) => setCapacidad(Number(e.target.value))}
                  required
                  className="w-full bg-page border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent/50"
                />
              </div>
            </div>

            {esRecurrente && (
              <div>
                <label className="block text-sm font-medium mb-1 text-gray-300">Termina</label>
                <div className="flex gap-4 items-end">
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setModoFin('weeks')}
                      className={clsx(
                        'text-xs px-3 py-1.5 rounded-lg transition-colors',
                        modoFin === 'weeks' ? 'bg-accentsoft text-accent' : 'bg-white/5 text-gray-400'
                      )}
                    >
                      Nº de semanas
                    </button>
                    <button
                      type="button"
                      onClick={() => setModoFin('date')}
                      className={clsx(
                        'text-xs px-3 py-1.5 rounded-lg transition-colors',
                        modoFin === 'date' ? 'bg-accentsoft text-accent' : 'bg-white/5 text-gray-400'
                      )}
                    >
                      Fecha concreta
                    </button>
                  </div>

                  {modoFin === 'weeks' ? (
                    <input
                      type="number"
                      min={1}
                      max={52}
                      value={semanas}
                      onChange={(e) => setSemanas(Number(e.target.value))}
                      className="w-24 bg-page border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-accent/50"
                    />
                  ) : (
                    <input
                      type="date"
                      value={fechaFin}
                      onChange={(e) => setFechaFin(e.target.value)}
                      required
                      className="bg-page border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-accent/50"
                    />
                  )}
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={cargando || (esRecurrente && diasSeleccionados.length === 0)}
              className="bg-accent text-page font-medium px-4 py-2 rounded-xl hover:brightness-95 active:brightness-90 disabled:opacity-50 transition-all"
            >
              {cargando ? 'Creando...' : esRecurrente ? 'Crear clases recurrentes' : 'Crear clase'}
            </button>
          </form>
        )}

        {/* Cabecera del mes */}
        <div className="flex items-center justify-between mb-2">
          <button
            onClick={irMesAnterior}
            className="w-8 h-8 rounded-full bg-card flex items-center justify-center text-sm hover:bg-cardhover text-gray-300"
            aria-label="Mes anterior"
          >
            ‹
          </button>
          <h2 className="font-bold text-sm capitalize text-white">
            {mesReferencia.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })}
          </h2>
          <button
            onClick={irMesSiguiente}
            className="w-8 h-8 rounded-full bg-card flex items-center justify-center text-sm hover:bg-cardhover text-gray-300"
            aria-label="Mes siguiente"
          >
            ›
          </button>
        </div>

        <div className="grid grid-cols-7 gap-1 mb-1">
          {NOMBRES_DIA.map((n) => (
            <div key={n} className="text-center text-[10px] text-gray-500 font-semibold py-0.5">
              {n}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1 mb-6 justify-items-center">
          {diasCuadricula.map((dia) => {
            const perteneceAlMes = dia.getMonth() === mesReferencia.getMonth();
            const esHoy = mismodia(dia, hoy);
            const seleccionado = mismodia(dia, diaSeleccionado);
            const tieneClase = tieneClaseEseDia(dia);

            return (
              <button
                key={dia.toISOString()}
                disabled={!perteneceAlMes}
                onClick={() => setDiaSeleccionado(dia)}
                className={clsx(
                  'relative w-9 h-9 rounded-lg flex flex-col items-center justify-center text-xs font-semibold transition',
                  !perteneceAlMes ? 'text-gray-700 cursor-not-allowed' : 'text-gray-200 hover:bg-cardhover',
                  seleccionado && perteneceAlMes ? 'bg-accent text-page' : '',
                  esHoy && !seleccionado ? 'ring-1 ring-accent/60' : ''
                )}
              >
                {dia.getDate()}
                {tieneClase && (
                  <span
                    className={clsx(
                      'absolute bottom-1 w-1 h-1 rounded-full',
                      seleccionado ? 'bg-page' : 'bg-accent'
                    )}
                  />
                )}
              </button>
            );
          })}
        </div>

        {/* Clases del día elegido */}
        <h3 className="text-sm font-bold text-gray-300 mb-3 capitalize">
          {diaSeleccionado.toLocaleDateString('es-ES', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
          })}
        </h3>

        {clasesDelDia.length === 0 && (
          <p className="text-gray-500 text-sm py-6 text-center">No hay clases programadas este día.</p>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {clasesDelDia.map((clase) => {
            const ocupacion = clase._count.bookings / clase.capacity;
            const completa = clase._count.bookings >= clase.capacity;
            return (
              <button
                key={clase.id}
                onClick={() => abrirModal(clase.id)}
                className={clsx(
                  'text-left rounded-2xl p-4 border transition hover:brightness-95',
                  clase.cancelled ? 'bg-white/[0.02] border-white/5 opacity-60' : 'bg-card border-transparent'
                )}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-lg font-bold text-white">
                    {new Date(clase.date).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                  {clase.cancelled && (
                    <span className="text-[10px] font-bold bg-dangersoft text-danger px-2 py-0.5 rounded-full">
                      CANCELADA
                    </span>
                  )}
                </div>
                {!clase.cancelled && (
                  <>
                    <div className="h-1.5 w-full bg-page rounded-full overflow-hidden mb-1">
                      <div
                        className={clsx('h-full rounded-full', completa ? 'bg-danger' : 'bg-accent')}
                        style={{ width: `${Math.min(ocupacion * 100, 100)}%` }}
                      />
                    </div>
                    <p className="text-[11px] text-gray-400">
                      {clase._count.bookings}/{clase.capacity} plazas
                      {clase.enEspera > 0 && ` · ${clase.enEspera} en espera`}
                    </p>
                  </>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {detalle && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          <div className="absolute inset-0 bg-black/60" onClick={cerrarModal} />
          <div className="relative bg-card w-full sm:max-w-md sm:rounded-3xl rounded-t-3xl p-5 max-h-[85vh] overflow-y-auto">
            <div className="flex items-start justify-between mb-4">
              <div>
                <p className="text-accent text-[11px] font-semibold uppercase tracking-widest mb-1">
                  {new Date(detalle.date).toLocaleDateString('es-ES', {
                    weekday: 'long',
                    day: 'numeric',
                    month: 'long',
                  })}
                </p>
                <h3 className="text-2xl font-extrabold text-white">
                  {new Date(detalle.date).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                </h3>
              </div>
              <button
                onClick={cerrarModal}
                aria-label="Cerrar"
                className="w-8 h-8 shrink-0 rounded-full bg-white/5 flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 text-lg leading-none"
              >
                ×
              </button>
            </div>

            {detalle.cancelled && (
              <div className="mb-4 bg-dangersoft border border-danger/30 text-danger text-sm px-4 py-3 rounded-xl">
                Esta clase fue cancelada. Las reservas confirmadas se liberaron sin penalizar a nadie.
              </div>
            )}

            {errorModal && (
              <p className="text-danger text-sm bg-dangersoft border border-danger/20 p-2 rounded-xl mb-4">
                {errorModal}
              </p>
            )}

            <div className="mb-5">
              <p className="text-[11px] font-bold uppercase tracking-widest text-gray-500 mb-2">
                Apuntados
              </p>
              {cargandoDetalle && <p className="text-gray-500 text-sm">Cargando...</p>}
              {!cargandoDetalle && detalle.bookings.length === 0 && (
                <p className="text-xs text-gray-500">Nadie se ha apuntado todavía.</p>
              )}
              {!cargandoDetalle && detalle.bookings.length > 0 && (
                <div className="space-y-2">
                  {detalle.bookings.map((b) => (
                    <div key={b.id} className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2.5 min-w-0">
                        {b.user.profileImageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={b.user.profileImageUrl}
                            alt=""
                            className="w-6 h-6 rounded-full object-cover shrink-0"
                          />
                        ) : (
                          <div className="w-6 h-6 rounded-full bg-white/10 text-gray-300 flex items-center justify-center text-[10px] font-bold shrink-0">
                            {b.user.name.charAt(0).toUpperCase()}
                          </div>
                        )}
                        <span className="text-gray-200 text-sm truncate">{b.user.name}</span>
                      </div>
                      <span
                        className={clsx(
                          'text-[10px] font-bold px-2 py-0.5 rounded-full border shrink-0',
                          ESTILO_ESTADO[b.status]
                        )}
                      >
                        {ETIQUETA_ESTADO[b.status]}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {!detalle.cancelled && (
              <>
                <div className="mb-4">
                  <p className="text-[11px] font-bold uppercase tracking-widest text-gray-500 mb-2">
                    Editar
                  </p>
                  <div className="flex gap-2">
                    <input
                      type="date"
                      value={editFecha}
                      onChange={(e) => setEditFecha(e.target.value)}
                      className="flex-1 bg-page border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-accent/50"
                    />
                    <input
                      type="time"
                      value={editHora}
                      onChange={(e) => setEditHora(e.target.value)}
                      className="w-24 bg-page border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-accent/50"
                    />
                    <input
                      type="number"
                      min={detalle._count.bookings}
                      value={editCapacidad}
                      onChange={(e) => setEditCapacidad(Number(e.target.value))}
                      className="w-16 bg-page border border-white/10 rounded-xl px-2 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-accent/50"
                    />
                  </div>
                  <button
                    onClick={guardarEdicion}
                    disabled={guardando}
                    className="w-full mt-2 bg-accent text-page text-sm font-bold py-2 rounded-xl hover:brightness-95 disabled:opacity-50"
                  >
                    {guardando ? 'Guardando...' : 'Guardar cambios'}
                  </button>
                </div>

                {confirmandoCancelar ? (
                  <div className="bg-dangersoft border border-danger/30 rounded-xl p-3">
                    <p className="text-danger text-xs mb-2">
                      ¿Seguro? Se liberarán las reservas confirmadas sin penalizar a nadie, y se
                      borrará la lista de espera.
                    </p>
                    <div className="flex gap-2">
                      <button
                        onClick={confirmarCancelacion}
                        disabled={cancelando}
                        className="flex-1 bg-danger text-white text-xs font-bold py-2 rounded-lg disabled:opacity-50"
                      >
                        {cancelando ? 'Cancelando...' : 'Sí, cancelar clase'}
                      </button>
                      <button
                        onClick={() => setConfirmandoCancelar(false)}
                        className="flex-1 bg-white/5 text-gray-300 text-xs font-semibold py-2 rounded-lg"
                      >
                        No
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => setConfirmandoCancelar(true)}
                    className="w-full text-xs text-gray-500 hover:text-danger py-1"
                  >
                    Cancelar esta clase
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
