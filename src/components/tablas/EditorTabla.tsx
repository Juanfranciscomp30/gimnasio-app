'use client';

import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faArrowUp,
  faArrowDown,
  faXmark,
  faPlus,
  faFloppyDisk,
  faLink,
  faLinkSlash,
} from '@fortawesome/free-solid-svg-icons';
import clsx from 'clsx';
import { tapScale } from '@/lib/motion';
import { ETIQUETA_PLAN, ETIQUETA_VARIANTE, MESES, letraBloque, type Ejercicio, type Tabla } from './tipos';

const INPUT =
  'bg-page text-gray-100 normal-case tracking-normal border border-white/10 rounded-lg px-2.5 py-1.5 text-sm placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-accent/50';

// Lo que se edita en pantalla. Los números van como texto mientras se
// escriben (para poder dejar el campo vacío) y se convierten al guardar.
type Fila = {
  key: string;
  exerciseId: string;
  // true = va en el mismo bloque (superserie) que el ejercicio de arriba
  conAnterior: boolean;
  sets: string;
  reps: string;
  rest: string;
  notes: string;
};

type DiaEditor = { dayNumber: number; name: string; filas: Fila[] };

/**
 * Número de bloque de cada fila: empieza uno nuevo salvo que la fila esté
 * unida a la de arriba. Así "Press + Sentadilla, Fondos" -> 0, 0, 1.
 */
function numerarBloques(filas: Fila[]) {
  let bloque = -1;
  return filas.map((fila, i) => {
    if (i === 0 || !fila.conAnterior) bloque++;
    return { fila, block: bloque };
  });
}

let contadorClaves = 0;
const nuevaClave = () => `fila-${++contadorClaves}`;

function desdeTabla(tabla: Tabla): DiaEditor[] {
  return tabla.days.map((d) => ({
    dayNumber: d.dayNumber,
    name: d.name ?? '',
    filas: d.exercises.map((e, i) => ({
      key: nuevaClave(),
      exerciseId: e.exerciseId,
      conAnterior: i > 0 && d.exercises[i - 1].block === e.block,
      sets: String(e.sets),
      reps: e.reps ?? '',
      rest: e.restSeconds != null ? String(e.restSeconds) : '',
      notes: e.notes ?? '',
    })),
  }));
}

export default function EditorTabla({
  tabla,
  ejercicios,
  onGuardada,
  onEliminada,
}: {
  tabla: Tabla;
  ejercicios: Ejercicio[];
  onGuardada: (tabla: Tabla) => void;
  onEliminada: () => void;
}) {
  const [titulo, setTitulo] = useState(tabla.title ?? '');
  const [notas, setNotas] = useState(tabla.notes ?? '');
  const [dias, setDias] = useState<DiaEditor[]>(() => desdeTabla(tabla));
  const [diaActivo, setDiaActivo] = useState(1);
  const [ejercicioANadir, setEjercicioANadir] = useState('');
  const [cambios, setCambios] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  const [ok, setOk] = useState(false);
  const [confirmarBorrado, setConfirmarBorrado] = useState(false);

  // Si cambia la tabla seleccionada (otro mes/tarifa), recargamos el editor
  useEffect(() => {
    setTitulo(tabla.title ?? '');
    setNotas(tabla.notes ?? '');
    setDias(desdeTabla(tabla));
    setDiaActivo(1);
    setCambios(false);
    setError('');
    setConfirmarBorrado(false);
  }, [tabla]);

  const porId = useMemo(() => new Map(ejercicios.map((e) => [e.id, e])), [ejercicios]);

  // Ejercicios del catálogo agrupados por grupo muscular para el <select>
  const gruposCatalogo = useMemo(() => {
    const grupos = new Map<string, Ejercicio[]>();
    for (const e of ejercicios) {
      const g = e.muscleGroup || 'Otros';
      grupos.set(g, [...(grupos.get(g) ?? []), e]);
    }
    return Array.from(grupos.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [ejercicios]);

  const dia = dias.find((d) => d.dayNumber === diaActivo) ?? dias[0];
  const bloquesDia = dia ? numerarBloques(dia.filas) : [];

  function modificarDia(cambio: (d: DiaEditor) => DiaEditor) {
    setDias((actuales) => actuales.map((d) => (d.dayNumber === diaActivo ? cambio(d) : d)));
    setCambios(true);
    setOk(false);
  }

  function modificarFila(key: string, campo: 'sets' | 'reps' | 'rest' | 'notes', valor: string) {
    modificarDia((d) => ({
      ...d,
      filas: d.filas.map((f) => (f.key === key ? { ...f, [campo]: valor } : f)),
    }));
  }

  function alternarUnion(key: string) {
    modificarDia((d) => ({
      ...d,
      filas: d.filas.map((f) => (f.key === key ? { ...f, conAnterior: !f.conAnterior } : f)),
    }));
  }

  function mover(indice: number, direccion: -1 | 1) {
    modificarDia((d) => {
      const filas = [...d.filas];
      const destino = indice + direccion;
      if (destino < 0 || destino >= filas.length) return d;
      [filas[indice], filas[destino]] = [filas[destino], filas[indice]];
      return { ...d, filas };
    });
  }

  function anadirEjercicio() {
    if (!ejercicioANadir) return;
    modificarDia((d) => ({
      ...d,
      filas: [
        ...d.filas,
        {
          key: nuevaClave(),
          exerciseId: ejercicioANadir,
          conAnterior: false,
          // Por defecto, las mismas series que el ejercicio anterior
          sets: d.filas[d.filas.length - 1]?.sets ?? '4',
          reps: '',
          rest: '',
          notes: '',
        },
      ],
    }));
    setEjercicioANadir('');
  }

  async function guardar() {
    setError('');
    // Validamos aquí también para señalar el día con el problema
    for (const d of dias) {
      for (const f of d.filas) {
        const series = Number(f.sets);
        if (!Number.isInteger(series) || series < 1 || series > 20) {
          setDiaActivo(d.dayNumber);
          setError(`Revisa las series de "${porId.get(f.exerciseId)?.name}" (entre 1 y 20)`);
          return;
        }
      }
    }

    setGuardando(true);
    const res = await fetch(`/api/routines/${tabla.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: titulo.trim() || null,
        notes: notas.trim() || null,
        days: dias.map((d) => ({
          dayNumber: d.dayNumber,
          name: d.name.trim() || null,
          exercises: numerarBloques(d.filas).map(({ fila: f, block }) => ({
            exerciseId: f.exerciseId,
            block,
            sets: Number(f.sets),
            reps: f.reps.trim() || null,
            restSeconds: f.rest.trim() ? Math.round(Number(f.rest)) || 0 : null,
            notes: f.notes.trim() || null,
          })),
        })),
      }),
    });
    setGuardando(false);

    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setError(data?.error ?? 'No se ha podido guardar la tabla');
      return;
    }
    setCambios(false);
    setOk(true);
    onGuardada(await res.json());
  }

  async function eliminar() {
    const res = await fetch(`/api/routines/${tabla.id}`, { method: 'DELETE' });
    if (res.ok) onEliminada();
    else setError('No se ha podido borrar la tabla');
  }

  return (
    <div className="bg-card rounded-2xl p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-widest text-accent">
            {ETIQUETA_PLAN[tabla.weeklyPlan]}
          </p>
          <p className="text-sm text-gray-400">
            {ETIQUETA_VARIANTE[tabla.variant]} · <span className="capitalize">{MESES[tabla.month - 1]}</span> {tabla.year}
          </p>
        </div>
        {confirmarBorrado ? (
          <div className="flex items-center gap-3 text-xs">
            <span className="text-gray-400">¿Borrar la tabla? Los pesos apuntados se conservan.</span>
            <button onClick={eliminar} className="text-danger font-bold">
              Sí, borrar
            </button>
            <button onClick={() => setConfirmarBorrado(false)} className="text-gray-500">
              No
            </button>
          </div>
        ) : (
          <button
            onClick={() => setConfirmarBorrado(true)}
            className="text-xs text-gray-600 hover:text-danger"
          >
            Borrar tabla
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-4">
        <input
          value={titulo}
          onChange={(e) => {
            setTitulo(e.target.value);
            setCambios(true);
          }}
          placeholder="Título (opcional, ej: Fuerza base)"
          className={INPUT}
        />
        <input
          value={notas}
          onChange={(e) => {
            setNotas(e.target.value);
            setCambios(true);
          }}
          placeholder="Indicaciones generales (opcional)"
          className={INPUT}
        />
      </div>

      {/* Pestañas de días */}
      <div className="flex gap-1.5 mb-3">
        {dias.map((d) => (
          <button
            key={d.dayNumber}
            onClick={() => setDiaActivo(d.dayNumber)}
            className={clsx(
              'relative px-4 py-1.5 rounded-xl text-sm font-semibold transition-colors',
              d.dayNumber === diaActivo ? 'text-page' : 'text-gray-400 hover:text-white bg-white/5'
            )}
          >
            {d.dayNumber === diaActivo && (
              <motion.span
                layoutId="editor-tabla-dia"
                className="absolute inset-0 bg-accent rounded-xl"
                transition={{ type: 'spring', stiffness: 380, damping: 32 }}
              />
            )}
            <span className="relative">
              Día {d.dayNumber}
              <span className="ml-1.5 text-[10px] opacity-70">{d.filas.length}</span>
            </span>
          </button>
        ))}
      </div>

      {dia && (
        <>
          <input
            value={dia.name}
            onChange={(e) => modificarDia((d) => ({ ...d, name: e.target.value }))}
            placeholder={`Nombre del día ${dia.dayNumber} (ej: Pierna y glúteo)`}
            className={`${INPUT} w-full mb-3`}
          />

          <div>
            {dia.filas.length === 0 && (
              <p className="text-gray-500 text-sm py-4 text-center">
                Este día aún no tiene ejercicios. Añade el primero abajo.
              </p>
            )}
            <AnimatePresence initial={false}>
              {bloquesDia.map(({ fila: f, block }, i) => {
                const unida = i > 0 && f.conAnterior;
                const tamanoBloque = bloquesDia.filter((b) => b.block === block).length;
                return (
                <motion.div
                  key={f.key}
                  layout
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, height: 0 }}
                >
                  {/* Cabecera del bloque o botón para unirlo al de arriba */}
                  {!unida ? (
                    <div className={clsx('flex items-center justify-between gap-2 px-1 mb-1.5', i > 0 && 'mt-4')}>
                      <p className="text-[11px] font-bold uppercase tracking-widest text-gray-500">
                        Bloque {letraBloque(block)}
                        {tamanoBloque > 1 && <span className="text-accent normal-case tracking-normal font-semibold"> · superserie</span>}
                      </p>
                      {i > 0 && (
                        <button
                          onClick={() => alternarUnion(f.key)}
                          className="text-[11px] text-gray-500 hover:text-accent flex items-center gap-1.5"
                        >
                          <FontAwesomeIcon icon={faLink} className="w-2.5 h-2.5" />
                          Unir al bloque de arriba
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="flex justify-center -my-0.5 relative z-10">
                      <button
                        onClick={() => alternarUnion(f.key)}
                        title="Separar en otro bloque"
                        className="text-[10px] font-semibold text-accent bg-card border border-accent/30 hover:border-danger/50 hover:text-danger rounded-full px-2.5 py-0.5 flex items-center gap-1.5"
                      >
                        <FontAwesomeIcon icon={faLinkSlash} className="w-2.5 h-2.5" />
                        seguido de
                      </button>
                    </div>
                  )}
                <div
                  className={clsx(
                    'bg-page/60 border rounded-xl p-3',
                    tamanoBloque > 1 ? 'border-accent/20' : 'border-white/5'
                  )}
                >
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <p className="text-sm font-semibold text-gray-100 min-w-0 truncate">
                      <span className="text-gray-600 mr-2 tabular-nums">{i + 1}.</span>
                      {porId.get(f.exerciseId)?.name ?? 'Ejercicio'}
                      {porId.get(f.exerciseId)?.muscleGroup && (
                        <span className="text-gray-500 text-xs font-normal">
                          {' '}
                          · {porId.get(f.exerciseId)?.muscleGroup}
                        </span>
                      )}
                    </p>
                    <div className="flex items-center gap-1 shrink-0 text-gray-500">
                      <button
                        onClick={() => mover(i, -1)}
                        disabled={i === 0}
                        className="w-7 h-7 rounded-lg hover:bg-white/5 hover:text-white disabled:opacity-30"
                        aria-label="Subir"
                      >
                        <FontAwesomeIcon icon={faArrowUp} className="w-3 h-3" />
                      </button>
                      <button
                        onClick={() => mover(i, 1)}
                        disabled={i === bloquesDia.length - 1}
                        className="w-7 h-7 rounded-lg hover:bg-white/5 hover:text-white disabled:opacity-30"
                        aria-label="Bajar"
                      >
                        <FontAwesomeIcon icon={faArrowDown} className="w-3 h-3" />
                      </button>
                      <button
                        onClick={() => modificarDia((d) => ({ ...d, filas: d.filas.filter((x) => x.key !== f.key) }))}
                        className="w-7 h-7 rounded-lg hover:bg-dangersoft hover:text-danger"
                        aria-label="Quitar ejercicio"
                      >
                        <FontAwesomeIcon icon={faXmark} className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 sm:grid-cols-[70px_90px_90px_1fr] gap-2">
                    <label className="text-[10px] uppercase tracking-wider text-gray-500">
                      Series
                      <input
                        inputMode="numeric"
                        value={f.sets}
                        onChange={(e) => modificarFila(f.key, 'sets', e.target.value)}
                        className={`${INPUT} w-full mt-1`}
                      />
                    </label>
                    <label className="text-[10px] uppercase tracking-wider text-gray-500">
                      Reps
                      <input
                        value={f.reps}
                        onChange={(e) => modificarFila(f.key, 'reps', e.target.value)}
                        placeholder="a criterio"
                        className={`${INPUT} w-full mt-1`}
                      />
                    </label>
                    <label className="text-[10px] uppercase tracking-wider text-gray-500">
                      Descanso (s)
                      <input
                        inputMode="numeric"
                        value={f.rest}
                        onChange={(e) => modificarFila(f.key, 'rest', e.target.value)}
                        className={`${INPUT} w-full mt-1`}
                      />
                    </label>
                    <label className="col-span-3 sm:col-span-1 text-[10px] uppercase tracking-wider text-gray-500">
                      Nota
                      <input
                        value={f.notes}
                        onChange={(e) => modificarFila(f.key, 'notes', e.target.value)}
                        placeholder="ej: bajar lento, 3 s"
                        className={`${INPUT} w-full mt-1`}
                      />
                    </label>
                  </div>
                </div>
                </motion.div>
                );
              })}
            </AnimatePresence>
          </div>

          <div className="flex gap-2 mt-3">
            <select
              value={ejercicioANadir}
              onChange={(e) => setEjercicioANadir(e.target.value)}
              className={`${INPUT} flex-1 min-w-0`}
            >
              <option value="">
                {ejercicios.length === 0 ? 'Primero añade ejercicios al catálogo' : 'Elige un ejercicio del catálogo...'}
              </option>
              {gruposCatalogo.map(([grupo, lista]) => (
                <optgroup key={grupo} label={grupo}>
                  {lista.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.name}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
            <button
              onClick={anadirEjercicio}
              disabled={!ejercicioANadir}
              className="bg-white/5 hover:bg-white/10 text-sm font-semibold px-4 rounded-lg disabled:opacity-40 flex items-center gap-2"
            >
              <FontAwesomeIcon icon={faPlus} className="w-3 h-3" />
              Añadir
            </button>
          </div>
        </>
      )}

      {error && <p className="text-danger text-xs mt-3">{error}</p>}

      <div className="flex items-center justify-end gap-3 mt-5">
        {cambios && <span className="text-xs text-amber-400">Cambios sin guardar</span>}
        {ok && !cambios && <span className="text-xs text-accent">Tabla guardada</span>}
        <motion.button
          whileTap={tapScale}
          onClick={guardar}
          disabled={guardando || !cambios}
          className="bg-gradient-accent text-page text-sm font-bold px-5 py-2.5 rounded-xl shadow-glow disabled:opacity-40 disabled:shadow-none flex items-center gap-2"
        >
          <FontAwesomeIcon icon={faFloppyDisk} className="w-3.5 h-3.5" />
          {guardando ? 'Guardando...' : 'Guardar tabla'}
        </motion.button>
      </div>
    </div>
  );
}
