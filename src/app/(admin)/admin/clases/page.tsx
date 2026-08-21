'use client';

import { useEffect, useState } from 'react';

type ClaseConAforo = {
  id: string;
  date: string;
  capacity: number;
  _count: { bookings: number };
};

export default function ClasesAdminPage() {
  const [clases, setClases] = useState<ClaseConAforo[]>([]);
  const [fecha, setFecha] = useState('');
  const [hora, setHora] = useState('');
  const [capacidad, setCapacidad] = useState(10);
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);

  // Cargamos las clases al entrar en la página
  async function cargarClases() {
    const res = await fetch('/api/classes');
    const data = await res.json();
    setClases(data);
  }

  useEffect(() => {
    cargarClases();
  }, []);

  async function handleCrearClase(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setCargando(true);

    // Combinamos fecha + hora en un único ISO string, formato que espera la API
    const fechaHoraISO = new Date(`${fecha}T${hora}:00`).toISOString();

    const res = await fetch('/api/classes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date: fechaHoraISO, capacity: Number(capacidad) }),
    });

    setCargando(false);

    if (!res.ok) {
      const data = await res.json();
      setError(data.error || 'Error al crear la clase');
      return;
    }

    // Limpiamos el formulario y recargamos la lista
    setFecha('');
    setHora('');
    setCapacidad(10);
    cargarClases();
  }

  return (
    <div className="p-8 max-w-2xl mx-auto min-h-screen bg-[#0F1115]">
      <h1 className="text-2xl font-bold mb-6 text-white">Clases</h1>

      <form
        onSubmit={handleCrearClase}
        className="bg-[#1A1D23] border border-white/5 p-6 rounded-2xl shadow-sm mb-8 space-y-4"
      >
        <h2 className="font-semibold text-white">Crear nueva clase</h2>

        {error && (
          <p className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 p-2 rounded-xl">
            {error}
          </p>
        )}

        <div className="flex gap-4">
          <div className="flex-1">
            <label className="block text-sm font-medium mb-1 text-gray-300">Fecha</label>
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

        <button
          type="submit"
          disabled={cargando}
          className="bg-[#C6F135] text-[#0F1115] font-medium px-4 py-2 rounded-xl hover:brightness-95 active:brightness-90 disabled:opacity-50 transition-all"
        >
          {cargando ? 'Creando...' : 'Crear clase'}
        </button>
      </form>

      <h2 className="font-semibold mb-3 text-white">Próximas clases</h2>
      <div className="space-y-2">
        {clases.length === 0 && (
          <p className="text-gray-500 text-sm">Todavía no hay clases creadas.</p>
        )}
        {clases.map((clase) => (
          <div
            key={clase.id}
            className="bg-[#1A1D23] border border-white/5 p-4 rounded-2xl shadow-sm flex items-center justify-between"
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
            <span className="text-sm text-gray-400">
              {clase._count.bookings} / {clase.capacity} plazas
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}