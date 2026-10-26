'use client';

import { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlus, faTrash } from '@fortawesome/free-solid-svg-icons';
import type { Ejercicio } from './tipos';

const INPUT =
  'bg-page border border-white/10 rounded-xl px-3 py-2 text-sm placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-accent/50';

// Catálogo de ejercicios del gimnasio. Las tablas se montan escogiendo de
// aquí, y los pesos de los socios se guardan por ejercicio del catálogo.
export default function CatalogoEjercicios({
  ejercicios,
  onCambio,
}: {
  ejercicios: Ejercicio[];
  onCambio: () => void;
}) {
  const [nombre, setNombre] = useState('');
  const [grupo, setGrupo] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  const [aEliminar, setAEliminar] = useState<string | null>(null);
  const [filtro, setFiltro] = useState('');

  async function crear() {
    setError('');
    if (!nombre.trim()) {
      setError('Escribe el nombre del ejercicio');
      return;
    }
    setGuardando(true);
    const res = await fetch('/api/exercises', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: nombre.trim(), muscleGroup: grupo.trim() || undefined }),
    });
    setGuardando(false);
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setError(data?.error ?? 'No se ha podido crear el ejercicio');
      return;
    }
    setNombre('');
    onCambio();
  }

  async function eliminar(id: string) {
    setError('');
    const res = await fetch(`/api/exercises/${id}`, { method: 'DELETE' });
    setAEliminar(null);
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setError(data?.error ?? 'No se ha podido borrar');
      return;
    }
    onCambio();
  }

  const grupos = Array.from(
    new Set(ejercicios.map((e) => e.muscleGroup).filter((g): g is string => !!g))
  ).sort();
  const visibles = ejercicios.filter((e) =>
    `${e.name} ${e.muscleGroup ?? ''}`.toLowerCase().includes(filtro.trim().toLowerCase())
  );

  return (
    <div className="bg-card rounded-2xl p-4">
      <div className="grid grid-cols-1 sm:grid-cols-[1fr_180px_auto] gap-2 mb-2">
        <input
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && crear()}
          placeholder="Nuevo ejercicio (ej: Sentadilla goblet)"
          className={INPUT}
        />
        <input
          value={grupo}
          onChange={(e) => setGrupo(e.target.value)}
          placeholder="Grupo muscular"
          list="grupos-musculares"
          className={INPUT}
        />
        <datalist id="grupos-musculares">
          {grupos.map((g) => (
            <option key={g} value={g} />
          ))}
        </datalist>
        <button
          onClick={crear}
          disabled={guardando}
          className="bg-accent text-page text-xs font-bold px-4 py-2 rounded-xl hover:brightness-95 disabled:opacity-50 flex items-center justify-center gap-2"
        >
          <FontAwesomeIcon icon={faPlus} className="w-3 h-3" />
          {guardando ? 'Añadiendo...' : 'Añadir'}
        </button>
      </div>
      {error && <p className="text-danger text-xs mb-2">{error}</p>}

      {ejercicios.length > 8 && (
        <input
          value={filtro}
          onChange={(e) => setFiltro(e.target.value)}
          placeholder="Buscar en el catálogo..."
          className={`${INPUT} w-full mt-2 mb-1 text-xs py-1.5`}
        />
      )}

      <div className="mt-3 space-y-1 max-h-80 overflow-y-auto pr-1">
        {ejercicios.length === 0 && (
          <p className="text-gray-500 text-sm">
            Todavía no hay ejercicios. Añade los que uséis en el gimnasio para poder montar las tablas.
          </p>
        )}
        {visibles.map((e) => {
          const usos = (e._count?.routineExercises ?? 0) + (e._count?.setLogs ?? 0);
          return (
            <div
              key={e.id}
              className="bg-page/60 px-3 py-2 rounded-xl flex items-center justify-between gap-3 text-sm"
            >
              <div className="min-w-0">
                <span className="font-semibold text-gray-200">{e.name}</span>
                {e.muscleGroup && <span className="text-gray-500 text-xs"> · {e.muscleGroup}</span>}
              </div>
              {usos > 0 ? (
                <span className="text-[10px] text-gray-600 shrink-0" title="Se usa en tablas o tiene pesos apuntados">
                  En uso
                </span>
              ) : aEliminar === e.id ? (
                <div className="flex items-center gap-2 text-xs shrink-0">
                  <button onClick={() => eliminar(e.id)} className="text-danger font-bold">
                    Borrar
                  </button>
                  <button onClick={() => setAEliminar(null)} className="text-gray-500">
                    No
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setAEliminar(e.id)}
                  className="text-gray-600 hover:text-danger shrink-0"
                  aria-label={`Borrar ${e.name}`}
                >
                  <FontAwesomeIcon icon={faTrash} className="w-3 h-3" />
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
