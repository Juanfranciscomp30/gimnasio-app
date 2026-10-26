'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faCheck,
  faClockRotateLeft,
  faPlus,
  faMinus,
  faTrophy,
} from '@fortawesome/free-solid-svg-icons';
import clsx from 'clsx';
import { tapScale } from '@/lib/motion';
import { fechaCorta, kg, type EjercicioDeTabla, type HistorialEjercicio } from './tipos';

type FilaSerie = { weight: string; reps: string };

// Primer número de "8-12" / "10" / "30 seg" para sugerir repeticiones
function repsObjetivo(reps: string): string {
  return reps.match(/\d+/)?.[0] ?? '';
}

// Filas iniciales del formulario:
//  1. Si ya apuntó hoy, lo que apuntó (para poder corregirlo).
//  2. Si no, las series de la última vez que hizo este ejercicio — aunque
//     fuera hace meses con otra tabla. Así "recuerda" el peso.
//  3. Si nunca lo ha hecho, filas vacías con las reps objetivo.
function filasIniciales(item: EjercicioDeTabla, historial?: HistorialEjercicio): FilaSerie[] {
  if (historial?.hoy.length) {
    return historial.hoy.map((s) => ({ weight: String(s.weight), reps: String(s.reps) }));
  }
  const ultima = historial?.ultima?.sets ?? [];
  return Array.from({ length: Math.max(item.sets, 1) }, (_, i) => {
    const previa = ultima[i] ?? ultima[ultima.length - 1];
    return {
      weight: previa ? String(previa.weight) : '',
      reps: previa ? String(previa.reps) : repsObjetivo(item.reps),
    };
  });
}

const INPUT =
  'w-full bg-page border border-white/10 rounded-lg px-2 py-2 text-center text-sm tabular-nums placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-accent/50';

export default function TarjetaEjercicio({
  item,
  historial,
  hoy,
  onGuardado,
}: {
  item: EjercicioDeTabla;
  historial?: HistorialEjercicio;
  hoy: string;
  onGuardado: (nuevoRecord: number | null) => void;
}) {
  const [filas, setFilas] = useState<FilaSerie[]>(() => filasIniciales(item, historial));
  const [guardado, setGuardado] = useState(!!historial?.hoy.length);
  const [cambios, setCambios] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  const [nuevoRecord, setNuevoRecord] = useState(false);

  const ultima = historial?.ultima;
  const record = historial?.record ?? null;

  function cambiarFila(i: number, campo: keyof FilaSerie, valor: string) {
    setFilas((actuales) => actuales.map((f, j) => (j === i ? { ...f, [campo]: valor } : f)));
    setCambios(true);
  }

  async function guardar() {
    setError('');
    const series = [];
    for (const f of filas) {
      if (!f.weight.trim() && !f.reps.trim()) continue; // fila vacía: se ignora
      const weight = Number(f.weight.replace(',', '.') || '0');
      const reps = Number(f.reps || '0');
      if (!Number.isFinite(weight) || weight < 0 || !Number.isInteger(reps) || reps < 0) {
        setError('Revisa los números: peso en kg y repeticiones enteras');
        return;
      }
      series.push({ weight, reps });
    }

    setGuardando(true);
    const res = await fetch('/api/workout-logs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ exerciseId: item.exerciseId, date: hoy, sets: series }),
    });
    setGuardando(false);
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setError(data?.error ?? 'No se ha podido guardar');
      return;
    }

    const maximo = series.length ? Math.max(...series.map((s) => s.weight)) : null;
    const esRecord = maximo !== null && maximo > 0 && (record === null || maximo > record);
    setNuevoRecord(esRecord && record !== null);
    setGuardado(series.length > 0);
    setCambios(false);
    onGuardado(esRecord ? maximo : null);
  }

  return (
    <div
      className={clsx(
        'bg-card rounded-2xl p-4 border transition-colors',
        guardado && !cambios ? 'border-accent/30' : 'border-transparent'
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-bold text-gray-100 leading-tight">{item.exercise.name}</p>
          <p className="text-xs text-gray-400 mt-0.5">
            <span className="text-accent font-semibold">
              {item.sets} × {item.reps}
            </span>
            {item.restSeconds != null && item.restSeconds > 0 && <> · descanso {item.restSeconds}s</>}
            {item.exercise.muscleGroup && <> · {item.exercise.muscleGroup}</>}
          </p>
          {item.notes && <p className="text-xs text-gray-500 mt-1 italic">{item.notes}</p>}
        </div>
        {guardado && !cambios && (
          <span className="shrink-0 w-7 h-7 rounded-full bg-accentsoft text-accent flex items-center justify-center">
            <FontAwesomeIcon icon={faCheck} className="w-3 h-3" />
          </span>
        )}
      </div>

      {(ultima || record !== null) && (
        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3 text-[11px] text-gray-400">
          {ultima && (
            <span className="flex items-center gap-1.5">
              <FontAwesomeIcon icon={faClockRotateLeft} className="w-2.5 h-2.5 text-gray-500" />
              Última vez ({fechaCorta(ultima.date)}):{' '}
              <span className="text-gray-200 tabular-nums">
                {ultima.sets.map((s) => `${kg(s.weight)}×${s.reps}`).join(' · ')}
              </span>
            </span>
          )}
          {record !== null && record > 0 && (
            <span className="flex items-center gap-1.5">
              <FontAwesomeIcon icon={faTrophy} className="w-2.5 h-2.5 text-amber-400" />
              Récord: <span className="text-gray-200 tabular-nums">{kg(record)} kg</span>
            </span>
          )}
        </div>
      )}

      <div className="mt-3 space-y-1.5">
        <div className="grid grid-cols-[28px_1fr_1fr] gap-2 text-[10px] uppercase tracking-wider text-gray-500 px-0.5">
          <span>Serie</span>
          <span className="text-center">Peso (kg)</span>
          <span className="text-center">Reps</span>
        </div>
        {filas.map((f, i) => (
          <div key={i} className="grid grid-cols-[28px_1fr_1fr] gap-2 items-center">
            <span className="text-xs text-gray-500 tabular-nums text-center">{i + 1}</span>
            <input
              inputMode="decimal"
              value={f.weight}
              onChange={(e) => cambiarFila(i, 'weight', e.target.value)}
              placeholder="—"
              className={INPUT}
              aria-label={`Peso serie ${i + 1}`}
            />
            <input
              inputMode="numeric"
              value={f.reps}
              onChange={(e) => cambiarFila(i, 'reps', e.target.value)}
              placeholder="—"
              className={INPUT}
              aria-label={`Repeticiones serie ${i + 1}`}
            />
          </div>
        ))}
      </div>

      {error && <p className="text-danger text-xs mt-2">{error}</p>}

      <AnimatePresence>
        {nuevoRecord && (
          <motion.p
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="mt-2 text-xs font-bold text-amber-400 flex items-center gap-1.5"
          >
            <FontAwesomeIcon icon={faTrophy} className="w-3 h-3" />
            ¡Nuevo récord personal!
          </motion.p>
        )}
      </AnimatePresence>

      <div className="flex items-center justify-between gap-2 mt-3">
        <div className="flex gap-1">
          <button
            onClick={() => {
              setFilas((a) => [...a, { ...(a[a.length - 1] ?? { weight: '', reps: '' }) }]);
              setCambios(true);
            }}
            disabled={filas.length >= 20}
            className="h-8 px-3 rounded-lg bg-white/5 hover:bg-white/10 text-xs text-gray-300 flex items-center gap-1.5 disabled:opacity-40"
          >
            <FontAwesomeIcon icon={faPlus} className="w-2.5 h-2.5" /> Serie
          </button>
          <button
            onClick={() => {
              setFilas((a) => a.slice(0, -1));
              setCambios(true);
            }}
            disabled={filas.length <= 1}
            className="h-8 w-8 rounded-lg bg-white/5 hover:bg-white/10 text-gray-400 disabled:opacity-40"
            aria-label="Quitar última serie"
          >
            <FontAwesomeIcon icon={faMinus} className="w-2.5 h-2.5" />
          </button>
        </div>
        <motion.button
          whileTap={tapScale}
          onClick={guardar}
          disabled={guardando || (guardado && !cambios)}
          className={clsx(
            'h-9 px-4 rounded-xl text-xs font-bold disabled:opacity-60',
            guardado && !cambios ? 'bg-accentsoft text-accent' : 'bg-gradient-accent text-page shadow-glow'
          )}
        >
          {guardando ? 'Guardando...' : guardado && !cambios ? 'Apuntado hoy' : guardado ? 'Actualizar' : 'Apuntar'}
        </motion.button>
      </div>
    </div>
  );
}
