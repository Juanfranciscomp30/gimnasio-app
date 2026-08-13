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
    <div className="p-8 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Clases</h1>

      <form
        onSubmit={handleCrearClase}
        className="bg-white p-6 rounded-lg shadow mb-8 space-y-4"
      >
        <h2 className="font-semibold">Crear nueva clase</h2>

        {error && <p className="text-red-600 text-sm bg-red-50 p-2 rounded">{error}</p>}

        <div className="flex gap-4">
          <div className="flex-1">
            <label className="block text-sm font-medium mb-1">Fecha</label>
            <input
              type="date"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
              required
              className="w-full border rounded px-3 py-2"
            />
          </div>
          <div className="flex-1">
            <label className="block text-sm font-medium mb-1">Hora</label>
            <input
              type="time"
              value={hora}
              onChange={(e) => setHora(e.target.value)}
              required
              className="w-full border rounded px-3 py-2"
            />
          </div>
          <div className="w-28">
            <label className="block text-sm font-medium mb-1">Aforo</label>
            <input
              type="number"
              min={1}
              value={capacidad}
              onChange={(e) => setCapacidad(Number(e.target.value))}
              required
              className="w-full border rounded px-3 py-2"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={cargando}
          className="bg-gray-900 text-white px-4 py-2 rounded hover:bg-gray-800 disabled:opacity-50"
        >
          {cargando ? 'Creando...' : 'Crear clase'}
        </button>
      </form>

      <h2 className="font-semibold mb-3">Próximas clases</h2>
      <div className="space-y-2">
        {clases.length === 0 && (
          <p className="text-gray-500 text-sm">Todavía no hay clases creadas.</p>
        )}
        {clases.map((clase) => (
          <div
            key={clase.id}
            className="bg-white p-4 rounded-lg shadow flex items-center justify-between"
          >
            <span>
              {new Date(clase.date).toLocaleString('es-ES', {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </span>
            <span className="text-sm text-gray-600">
              {clase._count.bookings} / {clase.capacity} plazas
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}