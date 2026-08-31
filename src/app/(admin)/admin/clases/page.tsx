'use client';

import { useEffect, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faChevronDown, faChevronUp, faRepeat } from '@fortawesome/free-solid-svg-icons';
import clsx from 'clsx';

type ClaseConAforo = {
  id: string;
  date: string;
  capacity: number;
  _count: { bookings: number };
};

type Booking = {
  id: string;
  status: 'CONFIRMED' | 'CANCELLED_ON_TIME' | 'CANCELLED_LATE';
  user: { id: string; name: string; email: string };
};

type ClaseDetalle = ClaseConAforo & { bookings: Booking[] };

const DIAS_SEMANA = [
  { valor: 1, etiqueta: 'L' },
  { valor: 2, etiqueta: 'M' },
  { valor: 3, etiqueta: 'X' },
  { valor: 4, etiqueta: 'J' },
  { valor: 5, etiqueta: 'V' },
  { valor: 6, etiqueta: 'S' },
  { valor: 0, etiqueta: 'D' },
];

export default function ClasesAdminPage() {
  const [tab, setTab] = useState<'proximas' | 'historial'>('proximas');
  const [clases, setClases] = useState<ClaseConAforo[]>([]);
  const [cargandoLista, setCargandoLista] = useState(false);

  // Formulario
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

  // Historial: expandir clase para ver asistentes
  const [claseExpandidaId, setClaseExpandidaId] = useState<string | null>(null);
  const [detalleClase, setDetalleClase] = useState<ClaseDetalle | null>(null);
  const [cargandoDetalle, setCargandoDetalle] = useState(false);

  async function cargarClases(when: 'proximas' | 'historial') {
    setCargandoLista(true);
    const query = when === 'proximas' ? 'upcoming' : 'past';
    const res = await fetch(`/api/classes?when=${query}`);
    const data = await res.json();
    setClases(data);
    setCargandoLista(false);
  }

  useEffect(() => {
    cargarClases(tab);
    setClaseExpandidaId(null);
    setDetalleClase(null);
  }, [tab]);

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

    // Reset parcial del formulario
    setFecha('');
    setHora('');
    setCapacidad(10);
    setDiasSeleccionados([]);
    setFechaFin('');

    if (tab === 'proximas') cargarClases('proximas');
  }

  async function handleExpandirClase(id: string) {
    if (claseExpandidaId === id) {
      setClaseExpandidaId(null);
      setDetalleClase(null);
      return;
    }
    setClaseExpandidaId(id);
    setCargandoDetalle(true);
    const res = await fetch(`/api/classes/${id}`);
    const data = await res.json();
    setDetalleClase(data);
    setCargandoDetalle(false);
  }

  return (
    <div className="p-8 max-w-2xl mx-auto min-h-screen bg-[#0F1115]">
      <h1 className="text-2xl font-bold mb-6 text-white">Clases</h1>

      {/* Formulario de creación */}
      <form
        onSubmit={handleCrearClase}
        className="bg-[#1A1D23] border border-white/5 p-6 rounded-2xl shadow-sm mb-8 space-y-4"
      >
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-white">Crear nueva clase</h2>
          <button
            type="button"
            onClick={() => setEsRecurrente((v) => !v)}
            className={clsx(
              'flex items-center gap-2 text-xs font-medium px-3 py-1.5 rounded-lg transition-colors',
              esRecurrente ? 'bg-[#C6F135]/10 text-[#C6F135]' : 'bg-white/5 text-gray-400 hover:text-white'
            )}
          >
            <FontAwesomeIcon icon={faRepeat} className="w-3 h-3" />
            Recurrente
          </button>
        </div>

        {error && (
          <p className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 p-2 rounded-xl">
            {error}
          </p>
        )}
        {mensajeExito && (
          <p className="text-[#C6F135] text-sm bg-[#C6F135]/10 border border-[#C6F135]/20 p-2 rounded-xl">
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
                      ? 'bg-[#C6F135] text-[#0F1115]'
                      : 'bg-[#0F1115] border border-white/10 text-gray-400 hover:text-white'
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
              className="w-full bg-[#0F1115] border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-[#C6F135]/50 focus:border-[#C6F135]/50"
            />
          </div>
          <div className="flex-1">
            <label className="block text-sm font-medium mb-1 text-gray-300">Hora</label>
            <input
              type="time"
              value={hora}
              onChange={(e) => setHora(e.target.value)}
              required
              className="w-full bg-[#0F1115] border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-[#C6F135]/50 focus:border-[#C6F135]/50"
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
              className="w-full bg-[#0F1115] border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-[#C6F135]/50 focus:border-[#C6F135]/50"
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
                    modoFin === 'weeks' ? 'bg-[#C6F135]/10 text-[#C6F135]' : 'bg-white/5 text-gray-400'
                  )}
                >
                  Nº de semanas
                </button>
                <button
                  type="button"
                  onClick={() => setModoFin('date')}
                  className={clsx(
                    'text-xs px-3 py-1.5 rounded-lg transition-colors',
                    modoFin === 'date' ? 'bg-[#C6F135]/10 text-[#C6F135]' : 'bg-white/5 text-gray-400'
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
                  className="w-24 bg-[#0F1115] border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-[#C6F135]/50"
                />
              ) : (
                <input
                  type="date"
                  value={fechaFin}
                  onChange={(e) => setFechaFin(e.target.value)}
                  required
                  className="bg-[#0F1115] border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-[#C6F135]/50"
                />
              )}
            </div>
          </div>
        )}

        <button
          type="submit"
          disabled={cargando || (esRecurrente && diasSeleccionados.length === 0)}
          className="bg-[#C6F135] text-[#0F1115] font-medium px-4 py-2 rounded-xl hover:brightness-95 active:brightness-90 disabled:opacity-50 transition-all"
        >
          {cargando ? 'Creando...' : esRecurrente ? 'Crear clases recurrentes' : 'Crear clase'}
        </button>
      </form>

      {/* Pestañas */}
      <div className="flex gap-1 mb-4 bg-[#1A1D23] p-1 rounded-xl w-fit border border-white/5">
        <button
          onClick={() => setTab('proximas')}
          className={clsx(
            'text-sm px-4 py-1.5 rounded-lg transition-colors',
            tab === 'proximas' ? 'bg-[#C6F135]/10 text-[#C6F135] font-medium' : 'text-gray-400'
          )}
        >
          Próximas
        </button>
        <button
          onClick={() => setTab('historial')}
          className={clsx(
            'text-sm px-4 py-1.5 rounded-lg transition-colors',
            tab === 'historial' ? 'bg-[#C6F135]/10 text-[#C6F135] font-medium' : 'text-gray-400'
          )}
        >
          Historial
        </button>
      </div>

      <div className="space-y-2">
        {cargandoLista && <p className="text-gray-500 text-sm">Cargando...</p>}
        {!cargandoLista && clases.length === 0 && (
          <p className="text-gray-500 text-sm">
            {tab === 'proximas' ? 'Todavía no hay clases creadas.' : 'Aún no hay clases pasadas.'}
          </p>
        )}
        {clases.map((clase) => (
          <div key={clase.id} className="bg-[#1A1D23] border border-white/5 rounded-2xl shadow-sm overflow-hidden">
            <button
              onClick={() => tab === 'historial' && handleExpandirClase(clase.id)}
              className={clsx(
                'w-full p-4 flex items-center justify-between text-left',
                tab === 'historial' && 'hover:bg-white/5 transition-colors'
              )}
            >
              <span className="text-gray-200">
                {new Date(clase.date).toLocaleString('es-ES', {
                  weekday: 'long',
                  day: 'numeric',
                  month: 'long',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
              <div className="flex items-center gap-3">
                <span className="text-sm text-gray-400">
                  {clase._count.bookings} / {clase.capacity} plazas
                </span>
                {tab === 'historial' && (
                  <FontAwesomeIcon
                    icon={claseExpandidaId === clase.id ? faChevronUp : faChevronDown}
                    className="w-3 h-3 text-gray-500"
                  />
                )}
              </div>
            </button>

            {tab === 'historial' && claseExpandidaId === clase.id && (
              <div className="border-t border-white/5 p-4 bg-[#0F1115]/40">
                {cargandoDetalle && <p className="text-gray-500 text-sm">Cargando asistentes...</p>}
                {!cargandoDetalle && detalleClase && detalleClase.bookings.length === 0 && (
                  <p className="text-gray-500 text-sm">Nadie reservó esta clase.</p>
                )}
                {!cargandoDetalle && detalleClase && detalleClase.bookings.length > 0 && (
                  <ul className="space-y-1.5">
                    {detalleClase.bookings.map((b) => (
                      <li key={b.id} className="flex items-center justify-between text-sm">
                        <span className="text-gray-200">{b.user.name}</span>
                        <span
                          className={clsx(
                            'text-xs px-2 py-0.5 rounded-full border',
                            b.status === 'CONFIRMED' && 'bg-[#C6F135]/10 text-[#C6F135] border-[#C6F135]/20',
                            b.status === 'CANCELLED_LATE' && 'bg-red-500/10 text-red-400 border-red-500/20',
                            b.status === 'CANCELLED_ON_TIME' && 'bg-white/5 text-gray-400 border-white/10'
                          )}
                        >
                          {b.status === 'CONFIRMED'
                            ? 'Asistió'
                            : b.status === 'CANCELLED_LATE'
                            ? 'Canceló tarde'
                            : 'Canceló a tiempo'}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}