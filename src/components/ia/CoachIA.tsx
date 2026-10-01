'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faWandMagicSparkles,
  faDumbbell,
  faAppleWhole,
  faRotate,
  faHouse,
  faChevronDown,
  faCircleInfo,
} from '@fortawesome/free-solid-svg-icons';
import clsx from 'clsx';
import type { PlanEntreno, PlanNutricion } from '@/lib/ai/opciones';
import { tapScale } from '@/lib/motion';
import Skeleton from '@/components/ui/Skeleton';

type Kind = 'TRAINING' | 'NUTRITION';

type Estado = {
  plan: { id: string; content: unknown; createdAt: string } | null;
  restantes: number;
  tienePerfil: boolean;
  iaDisponible: boolean;
};

const PESTANAS: { kind: Kind; etiqueta: string; icono: typeof faDumbbell }[] = [
  { kind: 'TRAINING', etiqueta: 'Entreno', icono: faDumbbell },
  { kind: 'NUTRITION', etiqueta: 'Nutrición', icono: faAppleWhole },
];

function VistaEntreno({ plan }: { plan: PlanEntreno }) {
  const [abierta, setAbierta] = useState(0);
  return (
    <div className="space-y-2">
      <p className="text-sm text-gray-300 mb-3">{plan.resumen}</p>
      {plan.sesiones.map((s, i) => (
        <div key={i} className="bg-page/60 rounded-xl overflow-hidden">
          <button
            onClick={() => setAbierta(abierta === i ? -1 : i)}
            className="w-full flex items-center justify-between px-3 py-2.5 text-left"
          >
            <span>
              <span className="block text-sm font-semibold text-white">{s.titulo}</span>
              <span className="block text-[11px] text-gray-500">{s.enfoque}</span>
            </span>
            <FontAwesomeIcon
              icon={faChevronDown}
              className={clsx('w-3 h-3 text-gray-500 transition-transform', abierta === i && 'rotate-180')}
            />
          </button>
          <AnimatePresence initial={false}>
            {abierta === i && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="px-3 pb-3 space-y-2">
                  <p className="text-[11px] text-gray-400">
                    <span className="text-accent font-semibold">Calentamiento:</span> {s.calentamiento}
                  </p>
                  {s.ejercicios.map((e, j) => (
                    <div key={j} className="flex items-start justify-between gap-3 text-sm border-t border-white/5 pt-2">
                      <div>
                        <p className="text-gray-200">{e.nombre}</p>
                        {e.nota && <p className="text-[11px] text-gray-500">{e.nota}</p>}
                      </div>
                      <span className="text-xs font-bold text-accent tabular-nums whitespace-nowrap">{e.series}</span>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      ))}
      {plan.extraEnCasa && (
        <div className="bg-page/60 rounded-xl px-3 py-2.5">
          <p className="text-sm font-semibold text-white flex items-center gap-2 mb-1">
            <FontAwesomeIcon icon={faHouse} className="w-3 h-3 text-accent" />
            {plan.extraEnCasa.titulo}
          </p>
          <ul className="text-xs text-gray-400 list-disc pl-5 space-y-0.5">
            {plan.extraEnCasa.ejercicios.map((e, i) => (
              <li key={i}>{e}</li>
            ))}
          </ul>
        </div>
      )}
      <p className="text-xs text-accent/90 italic pt-1">“{plan.consejo}”</p>
    </div>
  );
}

function VistaNutricion({ plan }: { plan: PlanNutricion }) {
  return (
    <div className="space-y-3">
      <p className="text-sm text-gray-300">{plan.resumen}</p>
      <ul className="space-y-1.5">
        {plan.claves.map((c, i) => (
          <li key={i} className="text-xs text-gray-300 flex gap-2">
            <span className="text-accent font-bold">·</span>
            {c}
          </li>
        ))}
      </ul>
      <div className="bg-page/60 rounded-xl p-3 space-y-2">
        <p className="text-[11px] font-bold uppercase tracking-widest text-gray-500">Ejemplo de un día</p>
        {plan.ejemploDia.map((c, i) => (
          <div key={i} className="text-sm">
            <span className="text-accent font-semibold">{c.comida}: </span>
            <span className="text-gray-300">{c.idea}</span>
          </div>
        ))}
      </div>
      <p className="text-xs text-gray-300">
        <span className="text-accent font-semibold">Día de clase: </span>
        {plan.diaDeEntreno}
      </p>
      <p className="text-[11px] text-gray-500 flex gap-1.5">
        <FontAwesomeIcon icon={faCircleInfo} className="w-3 h-3 mt-0.5 shrink-0" />
        {plan.aviso}
      </p>
    </div>
  );
}

// Tarjeta del "Coach IA" en /inicio: plan de entreno y de nutrición de
// la semana, generados bajo demanda y guardados en BD.
export default function CoachIA() {
  const [kind, setKind] = useState<Kind>('TRAINING');
  const [estados, setEstados] = useState<Partial<Record<Kind, Estado>>>({});
  const [generando, setGenerando] = useState(false);
  const [error, setError] = useState('');

  const cargar = useCallback(async (k: Kind) => {
    const res = await fetch(`/api/ai/plan?kind=${k}`);
    if (res.ok) {
      const data: Estado = await res.json();
      setEstados((prev) => ({ ...prev, [k]: data }));
    }
  }, []);

  useEffect(() => {
    if (!estados[kind]) cargar(kind);
  }, [kind, estados, cargar]);

  async function generar() {
    setError('');
    setGenerando(true);
    const res = await fetch('/api/ai/plan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind }),
    });
    const data = await res.json();
    setGenerando(false);
    if (!res.ok) {
      setError(data.error);
      return;
    }
    await cargar(kind);
  }

  const estado = estados[kind];

  // Si el gimnasio no ha configurado la API key, no mostramos nada.
  if (estado && !estado.iaDisponible) return null;

  return (
    <div className="bg-card bg-gradient-card-glow rounded-2xl p-5 mb-3 border border-accent/15">
      <div className="flex items-center justify-between mb-4">
        <p className="text-[11px] font-bold uppercase tracking-widest text-accent flex items-center gap-1.5">
          <FontAwesomeIcon icon={faWandMagicSparkles} className="w-3 h-3" />
          Tu coach IA
        </p>
        <div className="flex bg-page rounded-xl p-0.5">
          {PESTANAS.map((p) => (
            <button
              key={p.kind}
              onClick={() => {
                setKind(p.kind);
                setError('');
              }}
              className={clsx(
                'text-xs font-semibold px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors',
                kind === p.kind ? 'bg-accentsoft text-accent' : 'text-gray-500 hover:text-white'
              )}
            >
              <FontAwesomeIcon icon={p.icono} className="w-3 h-3" />
              {p.etiqueta}
            </button>
          ))}
        </div>
      </div>

      {!estado ? (
        <div className="space-y-2">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-16" />
        </div>
      ) : generando ? (
        <div className="py-6 text-center">
          <FontAwesomeIcon icon={faWandMagicSparkles} className="w-6 h-6 text-accent animate-pulse mb-2" />
          <p className="text-xs text-gray-400">Preparando tu plan personalizado…</p>
        </div>
      ) : estado.plan ? (
        <AnimatePresence mode="wait">
          <motion.div key={estado.plan.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
            {kind === 'TRAINING' ? (
              <VistaEntreno plan={estado.plan.content as PlanEntreno} />
            ) : (
              <VistaNutricion plan={estado.plan.content as PlanNutricion} />
            )}
          </motion.div>
        </AnimatePresence>
      ) : (
        <div className="text-center py-3">
          <p className="text-sm text-gray-300 mb-1">
            {kind === 'TRAINING'
              ? 'Pide tu plan de entreno de la semana, adaptado a tu tarifa y tu nivel.'
              : 'Recibe ideas de comidas sencillas pensadas para tu objetivo.'}
          </p>
          {!estado.tienePerfil && (
            <p className="text-xs text-gray-500">
              Para que sea más personalizado,{' '}
              <Link href="/perfil" className="text-accent font-semibold">
                completa tu perfil
              </Link>
              .
            </p>
          )}
        </div>
      )}

      {error && <p className="text-xs text-danger mt-3">{error}</p>}

      {estado && !generando && (
        <div className="flex items-center justify-between mt-4 pt-3 border-t border-white/5">
          <span className="text-[11px] text-gray-500">
            {estado.restantes > 0
              ? `Te quedan ${estado.restantes} esta semana`
              : 'Sin generaciones hasta el lunes'}
          </span>
          <motion.button
            whileTap={tapScale}
            onClick={generar}
            disabled={estado.restantes === 0}
            className={clsx(
              'text-xs font-bold px-3 py-1.5 rounded-xl flex items-center gap-1.5 disabled:opacity-40',
              estado.plan ? 'bg-white/5 text-gray-200 hover:bg-white/10' : 'bg-gradient-accent text-page shadow-glow'
            )}
          >
            <FontAwesomeIcon icon={estado.plan ? faRotate : faWandMagicSparkles} className="w-3 h-3" />
            {estado.plan ? 'Generar otro' : 'Generar plan'}
          </motion.button>
        </div>
      )}
    </div>
  );
}
