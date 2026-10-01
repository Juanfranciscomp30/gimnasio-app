'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faWandMagicSparkles, faCircleCheck, faPen } from '@fortawesome/free-solid-svg-icons';
import clsx from 'clsx';
import { OBJETIVOS, NIVELES, DIETAS, MINUTOS_SESION, type Objetivo, type Nivel, type Dieta } from '@/lib/ai/opciones';
import { hoverLift, tapScale } from '@/lib/motion';

type Perfil = {
  goal: Objetivo;
  level: Nivel;
  minutesPerSession: number;
  trainsAtHome: boolean;
  dietPreference: Dieta | null;
  limitations: string | null;
};

const VACIO: Perfil = {
  goal: 'MEJORAR_FORMA',
  level: 'PRINCIPIANTE',
  minutesPerSession: 60,
  trainsAtHome: false,
  dietPreference: 'SIN_PREFERENCIA',
  limitations: '',
};

// Fila de "chips" seleccionables (más cómodo en móvil que un <select>)
function Chips<T extends string | number>({
  opciones,
  valor,
  onChange,
}: {
  opciones: { valor: T; etiqueta: string }[];
  valor: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {opciones.map((o) => (
        <button
          key={String(o.valor)}
          type="button"
          onClick={() => onChange(o.valor)}
          className={clsx(
            'text-xs font-semibold px-3 py-1.5 rounded-full border transition-colors',
            valor === o.valor
              ? 'bg-accentsoft border-accent/40 text-accent'
              : 'bg-white/5 border-transparent text-gray-400 hover:text-white'
          )}
        >
          {o.etiqueta}
        </button>
      ))}
    </div>
  );
}

const aOpciones = <K extends string>(o: Record<K, string>) =>
  (Object.entries(o) as [K, string][]).map(([valor, etiqueta]) => ({ valor, etiqueta }));

export default function CuestionarioFitness() {
  const [perfil, setPerfil] = useState<Perfil>(VACIO);
  const [guardado, setGuardado] = useState(false); // ¿existe ya en BD?
  const [editando, setEditando] = useState(false);
  const [cargando, setCargando] = useState(true);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/ai/profile')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data) {
          setPerfil({ ...data, limitations: data.limitations ?? '' });
          setGuardado(true);
        }
        setCargando(false);
      });
  }, []);

  function set<K extends keyof Perfil>(campo: K, valor: Perfil[K]) {
    setPerfil((p) => ({ ...p, [campo]: valor }));
  }

  async function guardar() {
    setError('');
    setEnviando(true);
    const res = await fetch('/api/ai/profile', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(perfil),
    });
    const data = await res.json();
    setEnviando(false);
    if (!res.ok) {
      setError(data.error);
      return;
    }
    setGuardado(true);
    setEditando(false);
  }

  if (cargando) return null;

  const mostrarFormulario = !guardado || editando;

  return (
    <div className="bg-card bg-gradient-card-glow rounded-2xl p-5 mb-4 border border-accent/10">
      <div className="flex items-center justify-between mb-1">
        <h2 className="text-sm font-bold flex items-center gap-2">
          <FontAwesomeIcon icon={faWandMagicSparkles} className="w-3.5 h-3.5 text-accent" />
          Tu perfil para el coach IA
        </h2>
        {guardado && !editando && (
          <button onClick={() => setEditando(true)} className="text-xs text-gray-400 hover:text-accent flex items-center gap-1">
            <FontAwesomeIcon icon={faPen} className="w-2.5 h-2.5" /> Editar
          </button>
        )}
      </div>

      <AnimatePresence mode="wait">
        {mostrarFormulario ? (
          <motion.div key="form" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4 mt-3">
            <p className="text-xs text-gray-400">
              Cuéntanos un poco de ti y la IA te preparará entrenos y sugerencias de alimentación a tu medida.
            </p>

            <div>
              <p className="text-[11px] text-gray-500 uppercase tracking-wide mb-2">Objetivo</p>
              <Chips opciones={aOpciones(OBJETIVOS)} valor={perfil.goal} onChange={(v) => set('goal', v)} />
            </div>
            <div>
              <p className="text-[11px] text-gray-500 uppercase tracking-wide mb-2">Nivel</p>
              <Chips opciones={aOpciones(NIVELES)} valor={perfil.level} onChange={(v) => set('level', v)} />
            </div>
            <div>
              <p className="text-[11px] text-gray-500 uppercase tracking-wide mb-2">Duración de cada sesión</p>
              <Chips
                opciones={MINUTOS_SESION.map((m) => ({ valor: m as number, etiqueta: `${m} min` }))}
                valor={perfil.minutesPerSession}
                onChange={(v) => set('minutesPerSession', v)}
              />
            </div>
            <div>
              <p className="text-[11px] text-gray-500 uppercase tracking-wide mb-2">Alimentación</p>
              <Chips
                opciones={aOpciones(DIETAS)}
                valor={perfil.dietPreference ?? 'SIN_PREFERENCIA'}
                onChange={(v) => set('dietPreference', v)}
              />
            </div>
            <label className="flex items-center justify-between gap-3 bg-white/5 rounded-xl px-3 py-2.5 cursor-pointer">
              <span className="text-xs text-gray-300">Quiero rutinas cortas para casa los días que no vengo</span>
              <input
                type="checkbox"
                checked={perfil.trainsAtHome}
                onChange={(e) => set('trainsAtHome', e.target.checked)}
                className="accent-[#C6F135] w-4 h-4"
              />
            </label>
            <div>
              <p className="text-[11px] text-gray-500 uppercase tracking-wide mb-2">
                ¿Algo a tener en cuenta? <span className="normal-case">(opcional)</span>
              </p>
              <input
                type="text"
                maxLength={200}
                value={perfil.limitations ?? ''}
                onChange={(e) => set('limitations', e.target.value)}
                placeholder="Ej: molestias en la rodilla, no me gusta correr…"
                className="w-full bg-page border border-white/10 rounded-xl px-3 py-2.5 text-sm placeholder:text-gray-600 focus:outline-none focus:border-accent/50"
              />
            </div>

            {error && <p className="text-xs text-danger">{error}</p>}

            <div className="flex gap-2">
              {guardado && (
                <button
                  type="button"
                  onClick={() => setEditando(false)}
                  className="flex-1 bg-white/5 text-gray-300 text-sm font-semibold py-2.5 rounded-xl hover:bg-white/10"
                >
                  Cancelar
                </button>
              )}
              <motion.button
                whileHover={hoverLift}
                whileTap={tapScale}
                onClick={guardar}
                disabled={enviando}
                className="flex-1 bg-gradient-accent text-page text-sm font-bold py-2.5 rounded-xl shadow-glow disabled:opacity-50"
              >
                {enviando ? 'Guardando...' : 'Guardar perfil'}
              </motion.button>
            </div>
          </motion.div>
        ) : (
          <motion.div key="resumen" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="mt-2">
            <p className="text-xs text-gray-400 flex items-center gap-1.5 mb-3">
              <FontAwesomeIcon icon={faCircleCheck} className="w-3 h-3 text-accent" />
              Perfil completado. Tus planes aparecen en Inicio.
            </p>
            <div className="flex flex-wrap gap-2">
              {[OBJETIVOS[perfil.goal], NIVELES[perfil.level], `${perfil.minutesPerSession} min`, perfil.dietPreference && DIETAS[perfil.dietPreference]]
                .filter(Boolean)
                .map((t) => (
                  <span key={t as string} className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-white/5 text-gray-300">
                    {t}
                  </span>
                ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
