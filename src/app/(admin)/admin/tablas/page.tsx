'use client';

import { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faChevronLeft, faChevronRight } from '@fortawesome/free-solid-svg-icons';
import clsx from 'clsx';
import { staggerContainer, fadeUpItem, tapScale } from '@/lib/motion';
import Skeleton from '@/components/ui/Skeleton';
import EditorTabla from '@/components/tablas/EditorTabla';
import CatalogoEjercicios from '@/components/tablas/CatalogoEjercicios';
import { ETIQUETA_PLAN, MESES, PLANES, type Ejercicio, type Plan, type Tabla } from '@/components/tablas/tipos';

type Mes = { year: number; month: number };

function mesDesplazado({ year, month }: Mes, delta: number): Mes {
  const d = new Date(year, month - 1 + delta, 1);
  return { year: d.getFullYear(), month: d.getMonth() + 1 };
}

const nombreMes = (m: Mes) => `${MESES[m.month - 1]} ${m.year}`;

// Tablas de ejercicios mensuales: una por tarifa (1, 2 o 3 días/semana).
// Cada socio ve automáticamente la de su tarifa en /mi-tabla.
export default function TablasAdminPage() {
  const [mes, setMes] = useState<Mes>(() => {
    const hoy = new Date();
    return { year: hoy.getFullYear(), month: hoy.getMonth() + 1 };
  });
  const [tablas, setTablas] = useState<Tabla[] | null>(null);
  const [tablasMesAnterior, setTablasMesAnterior] = useState<Tabla[]>([]);
  const [ejercicios, setEjercicios] = useState<Ejercicio[]>([]);
  const [planActivo, setPlanActivo] = useState<Plan>('TWO_DAYS');
  const [copiarDe, setCopiarDe] = useState('');
  const [creando, setCreando] = useState(false);
  const [error, setError] = useState('');

  const cargarEjercicios = useCallback(async () => {
    const res = await fetch('/api/exercises');
    if (res.ok) setEjercicios(await res.json());
  }, []);

  const cargarTablas = useCallback(async () => {
    const anterior = mesDesplazado(mes, -1);
    const [resMes, resAnterior] = await Promise.all([
      fetch(`/api/routines?year=${mes.year}&month=${mes.month}`),
      fetch(`/api/routines?year=${anterior.year}&month=${anterior.month}`),
    ]);
    setTablas(resMes.ok ? await resMes.json() : []);
    setTablasMesAnterior(resAnterior.ok ? await resAnterior.json() : []);
  }, [mes]);

  useEffect(() => {
    cargarEjercicios();
  }, [cargarEjercicios]);

  useEffect(() => {
    setTablas(null);
    cargarTablas();
  }, [cargarTablas]);

  const tablaActiva = tablas?.find((t) => t.weeklyPlan === planActivo) ?? null;

  // Por defecto proponemos copiar la tabla de la misma tarifa del mes
  // anterior (lo habitual es partir de ella y cambiar algunos ejercicios).
  useEffect(() => {
    const mismaTarifa = tablasMesAnterior.find((t) => t.weeklyPlan === planActivo);
    setCopiarDe(mismaTarifa?.id ?? '');
    setError('');
  }, [planActivo, tablasMesAnterior]);

  const opcionesCopia = [
    ...tablasMesAnterior.map((t) => ({ id: t.id, label: `${ETIQUETA_PLAN[t.weeklyPlan]} · ${nombreMes(t)}` })),
    ...(tablas ?? [])
      .filter((t) => t.weeklyPlan !== planActivo)
      .map((t) => ({ id: t.id, label: `${ETIQUETA_PLAN[t.weeklyPlan]} · ${nombreMes(t)}` })),
  ];

  async function crearTabla() {
    setError('');
    setCreando(true);
    const res = await fetch('/api/routines', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...mes, weeklyPlan: planActivo, copyFromId: copiarDe || undefined }),
    });
    setCreando(false);
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setError(data?.error ?? 'No se ha podido crear la tabla');
      return;
    }
    const nueva: Tabla = await res.json();
    setTablas((actuales) => [...(actuales ?? []), nueva]);
  }

  function contarEjercicios(t: Tabla) {
    return t.days.reduce((suma, d) => suma + d.exercises.length, 0);
  }

  return (
    <div className="min-h-screen bg-page bg-gradient-hero bg-no-repeat p-4 sm:p-8">
      <motion.div variants={staggerContainer} initial="hidden" animate="show" className="max-w-3xl mx-auto">
        <motion.div variants={fadeUpItem} className="flex flex-wrap items-end justify-between gap-3 mb-6">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">Tablas de ejercicios</h1>
            <p className="text-sm text-gray-500 mt-1">
              Una tabla por tarifa y mes. Cada socio ve la suya automáticamente.
            </p>
          </div>
          <div className="flex items-center gap-1 bg-card rounded-xl p-1">
            <button
              onClick={() => setMes((m) => mesDesplazado(m, -1))}
              className="w-8 h-8 rounded-lg text-gray-400 hover:text-white hover:bg-white/5"
              aria-label="Mes anterior"
            >
              <FontAwesomeIcon icon={faChevronLeft} className="w-3 h-3" />
            </button>
            <span className="text-sm font-semibold capitalize w-36 text-center">{nombreMes(mes)}</span>
            <button
              onClick={() => setMes((m) => mesDesplazado(m, 1))}
              className="w-8 h-8 rounded-lg text-gray-400 hover:text-white hover:bg-white/5"
              aria-label="Mes siguiente"
            >
              <FontAwesomeIcon icon={faChevronRight} className="w-3 h-3" />
            </button>
          </div>
        </motion.div>

        {/* Una tarjeta por tarifa con el estado de su tabla este mes */}
        <motion.div variants={fadeUpItem} className="grid grid-cols-3 gap-2 sm:gap-3 mb-5">
          {PLANES.map((plan) => {
            const tabla = tablas?.find((t) => t.weeklyPlan === plan);
            const activa = plan === planActivo;
            return (
              <motion.button
                key={plan}
                whileTap={tapScale}
                onClick={() => setPlanActivo(plan)}
                className={clsx(
                  'text-left rounded-2xl p-3 sm:p-4 border transition-colors',
                  activa ? 'bg-card border-accent/50 shadow-glow' : 'bg-card/60 border-white/5 hover:border-white/15'
                )}
              >
                <p className={clsx('text-xs sm:text-sm font-bold', activa ? 'text-accent' : 'text-gray-200')}>
                  {ETIQUETA_PLAN[plan]}
                </p>
                {tablas === null ? (
                  <Skeleton className="h-3 w-16 mt-2" />
                ) : tabla ? (
                  <p className="text-[11px] text-gray-400 mt-1">{contarEjercicios(tabla)} ejercicios</p>
                ) : (
                  <p className="text-[11px] text-amber-400 mt-1">Sin tabla</p>
                )}
              </motion.button>
            );
          })}
        </motion.div>

        <motion.div variants={fadeUpItem} className="mb-10">
          {tablas === null ? (
            <Skeleton className="h-64" />
          ) : tablaActiva ? (
            <EditorTabla
              tabla={tablaActiva}
              ejercicios={ejercicios}
              onGuardada={(t) => {
                setTablas((actuales) => (actuales ?? []).map((x) => (x.id === t.id ? t : x)));
                cargarEjercicios(); // actualiza los "En uso" del catálogo
              }}
              onEliminada={() => {
                setTablas((actuales) => (actuales ?? []).filter((x) => x.id !== tablaActiva.id));
                cargarEjercicios();
              }}
            />
          ) : (
            <div className="bg-card rounded-2xl p-5">
              <p className="font-semibold mb-1">
                No hay tabla de {ETIQUETA_PLAN[planActivo]} para <span className="capitalize">{nombreMes(mes)}</span>
              </p>
              <p className="text-sm text-gray-500 mb-4">
                Puedes crearla vacía o copiar otra y cambiar solo lo necesario.
              </p>
              <div className="flex flex-col sm:flex-row gap-2">
                <select
                  value={copiarDe}
                  onChange={(e) => setCopiarDe(e.target.value)}
                  className="flex-1 bg-page border border-white/10 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/50"
                >
                  <option value="">Empezar vacía</option>
                  {opcionesCopia.map((o) => (
                    <option key={o.id} value={o.id}>
                      Copiar de: {o.label}
                    </option>
                  ))}
                </select>
                <motion.button
                  whileTap={tapScale}
                  onClick={crearTabla}
                  disabled={creando}
                  className="bg-gradient-accent text-page text-sm font-bold px-5 py-2 rounded-xl shadow-glow disabled:opacity-50"
                >
                  {creando ? 'Creando...' : 'Crear tabla'}
                </motion.button>
              </div>
              {error && <p className="text-danger text-xs mt-2">{error}</p>}
            </div>
          )}
        </motion.div>

        <motion.h2 variants={fadeUpItem} className="font-bold text-sm text-gray-300 mb-3">
          Catálogo de ejercicios
        </motion.h2>
        <motion.div variants={fadeUpItem} className="mb-8">
          <CatalogoEjercicios ejercicios={ejercicios} onCambio={cargarEjercicios} />
        </motion.div>
      </motion.div>
    </div>
  );
}
