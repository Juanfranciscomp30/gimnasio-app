'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faClipboardList, faChartLine, faTrophy } from '@fortawesome/free-solid-svg-icons';
import clsx from 'clsx';
import { staggerContainer, fadeUpItem, tapScale } from '@/lib/motion';
import Skeleton from '@/components/ui/Skeleton';
import TarjetaEjercicio from '@/components/tablas/TarjetaEjercicio';
import GraficaProgreso from '@/components/tablas/GraficaProgreso';
import {
  ETIQUETA_PLAN,
  MESES,
  fechaCorta,
  hoyISO,
  kg,
  type HistorialEjercicio,
  type Plan,
  type ProgresoEjercicio,
  type Tabla,
} from '@/components/tablas/tipos';

type RespuestaMiTabla = {
  weeklyPlan: Plan;
  routine: Tabla | null;
  historial: Record<string, HistorialEjercicio>;
};

const CLAVE_DIA = 'mi-tabla-dia'; // recordamos el último día que abrió

export default function MiTablaPage() {
  const [vista, setVista] = useState<'tabla' | 'progreso'>('tabla');
  const [datos, setDatos] = useState<RespuestaMiTabla | null>(null);
  const [error, setError] = useState('');
  const [dia, setDia] = useState(1);
  const [progreso, setProgreso] = useState<ProgresoEjercicio[] | null>(null);
  const [ejercicioGrafica, setEjercicioGrafica] = useState<string | null>(null);
  const [hoy] = useState(hoyISO);

  const mesActual = { year: Number(hoy.slice(0, 4)), month: Number(hoy.slice(5, 7)) };

  useEffect(() => {
    const [year, month] = hoy.split('-').map(Number);
    fetch(`/api/routines/mine?year=${year}&month=${month}&today=${hoy}`)
      .then(async (res) => {
        if (!res.ok) throw new Error();
        const json: RespuestaMiTabla = await res.json();
        setDatos(json);
        try {
          const guardado = Number(localStorage.getItem(CLAVE_DIA));
          if (guardado && json.routine?.days.some((d) => d.dayNumber === guardado)) setDia(guardado);
        } catch {}
      })
      .catch(() => setError('No se ha podido cargar tu tabla'));
  }, [hoy]);

  // El progreso se pide al abrir la pestaña (y se vuelve a pedir si se
  // apuntan pesos nuevos, porque al guardar lo ponemos a null)
  useEffect(() => {
    if (vista !== 'progreso' || progreso !== null) return;
    fetch('/api/workout-logs')
      .then((res) => (res.ok ? res.json() : []))
      .then((json: ProgresoEjercicio[]) => {
        setProgreso(json);
        setEjercicioGrafica((actual) => actual ?? json[0]?.exerciseId ?? null);
      })
      .catch(() => setProgreso([]));
  }, [vista, progreso]);

  function elegirDia(n: number) {
    setDia(n);
    try {
      localStorage.setItem(CLAVE_DIA, String(n));
    } catch {}
  }

  function alGuardar(exerciseId: string, nuevoRecord: number | null) {
    setProgreso(null);
    if (nuevoRecord === null) return;
    setDatos((d) =>
      d
        ? {
            ...d,
            historial: {
              ...d.historial,
              [exerciseId]: { ...d.historial[exerciseId], record: nuevoRecord },
            },
          }
        : d
    );
  }

  const tabla = datos?.routine ?? null;
  const diaActual = tabla?.days.find((d) => d.dayNumber === dia) ?? tabla?.days[0];
  const ejercicioSeleccionado = progreso?.find((p) => p.exerciseId === ejercicioGrafica) ?? null;

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
            Entrenamiento
          </p>
          <h1 className="text-2xl font-extrabold tracking-tight">
            {vista === 'tabla' ? 'Mi tabla' : 'Mi progreso'}
          </h1>
        </motion.div>

        {/* Selector Tabla / Progreso */}
        <div className="px-5 mb-4">
          <div className="grid grid-cols-2 bg-card rounded-xl p-1">
            {(
              [
                { id: 'tabla', label: 'Tabla del mes', icon: faClipboardList },
                { id: 'progreso', label: 'Progreso', icon: faChartLine },
              ] as const
            ).map((op) => (
              <button
                key={op.id}
                onClick={() => setVista(op.id)}
                className={clsx(
                  'relative py-2 rounded-lg text-sm font-semibold flex items-center justify-center gap-2 transition-colors',
                  vista === op.id ? 'text-page' : 'text-gray-400'
                )}
              >
                {vista === op.id && (
                  <motion.span
                    layoutId="mi-tabla-vista"
                    className="absolute inset-0 bg-accent rounded-lg"
                    transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                  />
                )}
                <FontAwesomeIcon icon={op.icon} className="relative w-3 h-3" />
                <span className="relative">{op.label}</span>
              </button>
            ))}
          </div>
        </div>

        {error && <p className="px-5 text-danger text-sm">{error}</p>}

        {vista === 'tabla' && (
          <div className="px-5">
            {!datos && !error && (
              <div className="space-y-3">
                <Skeleton className="h-10" />
                <Skeleton className="h-48" />
                <Skeleton className="h-48" />
              </div>
            )}

            {datos && !tabla && (
              <div className="bg-card rounded-2xl p-6 text-center">
                <FontAwesomeIcon icon={faClipboardList} className="w-6 h-6 text-gray-600 mb-3" />
                <p className="font-semibold">Aún no hay tabla para {MESES[mesActual.month - 1]}</p>
                <p className="text-sm text-gray-500 mt-1">
                  Tu entrenador la publicará pronto ({ETIQUETA_PLAN[datos.weeklyPlan]}).
                </p>
              </div>
            )}

            {tabla && diaActual && (
              <>
                <p className="text-xs text-gray-500 mb-3">
                  <span className="capitalize">{MESES[tabla.month - 1]}</span> · {ETIQUETA_PLAN[tabla.weeklyPlan]}
                  {tabla.title && <> · <span className="text-gray-300">{tabla.title}</span></>}
                </p>
                {tabla.notes && (
                  <p className="text-sm text-gray-300 bg-card/60 border border-white/5 rounded-xl px-4 py-3 mb-4">
                    {tabla.notes}
                  </p>
                )}

                {tabla.days.length > 1 && (
                  <div className="flex gap-2 mb-4 overflow-x-auto scrollbar-hide">
                    {tabla.days.map((d) => (
                      <motion.button
                        key={d.dayNumber}
                        whileTap={tapScale}
                        onClick={() => elegirDia(d.dayNumber)}
                        className={clsx(
                          'shrink-0 text-left rounded-xl px-4 py-2 border transition-colors',
                          d.dayNumber === diaActual.dayNumber
                            ? 'bg-accentsoft border-accent/40 text-accent'
                            : 'bg-card border-transparent text-gray-400'
                        )}
                      >
                        <p className="text-sm font-bold">Día {d.dayNumber}</p>
                        {d.name && <p className="text-[11px] opacity-80 max-w-[140px] truncate">{d.name}</p>}
                      </motion.button>
                    ))}
                  </div>
                )}
                {tabla.days.length === 1 && diaActual.name && (
                  <p className="text-sm font-bold text-gray-200 mb-3">{diaActual.name}</p>
                )}

                <AnimatePresence mode="wait">
                  <motion.div
                    key={diaActual.dayNumber}
                    variants={staggerContainer}
                    initial="hidden"
                    animate="show"
                    exit={{ opacity: 0 }}
                    className="space-y-3"
                  >
                    {diaActual.exercises.length === 0 && (
                      <p className="text-gray-500 text-sm text-center py-8">Este día aún no tiene ejercicios.</p>
                    )}
                    {diaActual.exercises.map((item) => (
                      <motion.div key={item.id} variants={fadeUpItem}>
                        <TarjetaEjercicio
                          item={item}
                          historial={datos?.historial[item.exerciseId]}
                          hoy={hoy}
                          onGuardado={(r) => alGuardar(item.exerciseId, r)}
                        />
                      </motion.div>
                    ))}
                  </motion.div>
                </AnimatePresence>
              </>
            )}
          </div>
        )}

        {vista === 'progreso' && (
          <div className="px-5">
            {progreso === null && (
              <div className="space-y-3">
                <Skeleton className="h-56" />
                <Skeleton className="h-16" />
                <Skeleton className="h-16" />
              </div>
            )}

            {progreso?.length === 0 && (
              <div className="bg-card rounded-2xl p-6 text-center">
                <FontAwesomeIcon icon={faChartLine} className="w-6 h-6 text-gray-600 mb-3" />
                <p className="font-semibold">Todavía no has apuntado pesos</p>
                <p className="text-sm text-gray-500 mt-1">
                  Apunta tus series en la tabla del mes y aquí verás cómo vas mejorando.
                </p>
              </div>
            )}

            {ejercicioSeleccionado && (
              <div className="bg-card rounded-2xl p-4 mb-4">
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="min-w-0">
                    <p className="font-bold truncate">{ejercicioSeleccionado.name}</p>
                    <p className="text-xs text-gray-500">Peso máximo por sesión (kg)</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-[10px] uppercase tracking-wider text-gray-500">Récord</p>
                    <p className="text-lg font-extrabold text-accent tabular-nums">
                      {kg(ejercicioSeleccionado.record)} kg
                    </p>
                  </div>
                </div>
                <GraficaProgreso key={ejercicioSeleccionado.exerciseId} ejercicio={ejercicioSeleccionado} />
              </div>
            )}

            {progreso && progreso.length > 0 && (
              <motion.div variants={staggerContainer} initial="hidden" animate="show" className="space-y-2">
                {progreso.map((p) => {
                  const primera = p.sesiones[0].maxWeight;
                  const ultima = p.sesiones[p.sesiones.length - 1].maxWeight;
                  const diferencia = ultima - primera;
                  const activo = p.exerciseId === ejercicioGrafica;
                  return (
                    <motion.button
                      key={p.exerciseId}
                      variants={fadeUpItem}
                      whileTap={tapScale}
                      onClick={() => {
                        setEjercicioGrafica(p.exerciseId);
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                      }}
                      className={clsx(
                        'w-full text-left bg-card rounded-2xl px-4 py-3 flex items-center justify-between gap-3 border transition-colors',
                        activo ? 'border-accent/40' : 'border-transparent'
                      )}
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-semibold truncate">{p.name}</p>
                        <p className="text-[11px] text-gray-500">
                          {p.sesiones.length} {p.sesiones.length === 1 ? 'sesión' : 'sesiones'} · última{' '}
                          {fechaCorta(p.ultimaFecha)}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-bold tabular-nums flex items-center gap-1.5 justify-end">
                          <FontAwesomeIcon icon={faTrophy} className="w-2.5 h-2.5 text-amber-400" />
                          {kg(p.record)} kg
                        </p>
                        {p.sesiones.length > 1 && diferencia !== 0 && (
                          <p
                            className={clsx(
                              'text-[11px] font-semibold tabular-nums',
                              diferencia > 0 ? 'text-accent' : 'text-danger'
                            )}
                          >
                            {diferencia > 0 ? '+' : '−'}
                            {kg(Math.abs(diferencia))} kg desde el inicio
                          </p>
                        )}
                      </div>
                    </motion.button>
                  );
                })}
              </motion.div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
