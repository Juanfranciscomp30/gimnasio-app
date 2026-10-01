'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faWandMagicSparkles,
  faRotate,
  faCircleCheck,
  faTriangleExclamation,
  faLightbulb,
  faPaperPlane,
  faHandshake,
  faListCheck,
} from '@fortawesome/free-solid-svg-icons';
import clsx from 'clsx';
import { staggerContainer, fadeUpItem, tapScale } from '@/lib/motion';
import Skeleton from '@/components/ui/Skeleton';
import type { ResumenIA } from '@/lib/ai/admin';

type Candidato = { userId: string; nombre: string; motivos: string[] };

const ICONO_PUNTO = {
  bien: { icon: faCircleCheck, clase: 'text-accent' },
  atencion: { icon: faTriangleExclamation, clase: 'text-amber-400' },
  idea: { icon: faLightbulb, clase: 'text-sky-400' },
} as const;

// ─── Resumen semanal ──────────────────────────────────────────────────
function ResumenSemanal() {
  const [informe, setInforme] = useState<{ content: ResumenIA; createdAt: string } | null>(null);
  const [disponible, setDisponible] = useState(true);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');

  async function cargar(refrescar = false) {
    setCargando(true);
    setError('');
    const res = await fetch(`/api/ai/admin/resumen${refrescar ? '?refrescar=1' : ''}`);
    const data = await res.json();
    setCargando(false);
    if (!res.ok) {
      setError(data.error);
      return;
    }
    setDisponible(data.iaDisponible);
    setInforme(data.informe);
    if (data.aviso) setError(data.aviso);
  }

  useEffect(() => {
    cargar();
  }, []);

  return (
    <motion.section variants={fadeUpItem} className="bg-card bg-gradient-card-glow border border-accent/15 rounded-2xl p-5 mb-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-[11px] font-bold uppercase tracking-widest text-accent flex items-center gap-1.5">
          <FontAwesomeIcon icon={faWandMagicSparkles} className="w-3 h-3" />
          Resumen de la semana
        </h2>
        {disponible && (
          <motion.button
            whileTap={tapScale}
            onClick={() => cargar(true)}
            disabled={cargando}
            className="text-xs text-gray-400 hover:text-accent flex items-center gap-1.5 disabled:opacity-40"
          >
            <FontAwesomeIcon icon={faRotate} className={clsx('w-3 h-3', cargando && 'animate-spin')} />
            Actualizar
          </motion.button>
        )}
      </div>

      {!disponible ? (
        <p className="text-sm text-gray-400">
          La IA no está activada. Añade <code className="text-accent">ANTHROPIC_API_KEY</code> en las variables de
          entorno (en local en <code>.env</code> y en Vercel en Settings → Environment Variables).
        </p>
      ) : cargando && !informe ? (
        <div className="space-y-2">
          <Skeleton className="h-5 w-2/3" />
          <Skeleton className="h-4" />
          <Skeleton className="h-4" />
          <Skeleton className="h-4 w-4/5" />
        </div>
      ) : informe ? (
        <div>
          <p className="text-lg font-bold text-white mb-4">{informe.content.titular}</p>
          <ul className="space-y-2.5 mb-5">
            {informe.content.puntos.map((p, i) => (
              <li key={i} className="flex gap-2.5 text-sm text-gray-300">
                <FontAwesomeIcon
                  icon={ICONO_PUNTO[p.tipo].icon}
                  className={clsx('w-3.5 h-3.5 mt-0.5 shrink-0', ICONO_PUNTO[p.tipo].clase)}
                />
                {p.texto}
              </li>
            ))}
          </ul>
          <div className="bg-page/60 rounded-xl p-4">
            <p className="text-[11px] font-bold uppercase tracking-widest text-gray-500 mb-2 flex items-center gap-1.5">
              <FontAwesomeIcon icon={faListCheck} className="w-3 h-3" /> Qué haría esta semana
            </p>
            <ol className="list-decimal pl-5 space-y-1 text-sm text-gray-200">
              {informe.content.acciones.map((a, i) => (
                <li key={i}>{a}</li>
              ))}
            </ol>
          </div>
          <p className="text-[11px] text-gray-600 mt-3">
            Generado el {new Date(informe.createdAt).toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' })}
          </p>
        </div>
      ) : null}
      {error && <p className="text-xs text-danger mt-3">{error}</p>}
    </motion.section>
  );
}

// ─── Reactivación de socios ───────────────────────────────────────────
function Reactivacion() {
  const [candidatos, setCandidatos] = useState<Candidato[] | null>(null);
  const [disponible, setDisponible] = useState(true);
  const [seleccion, setSeleccion] = useState<Set<string>>(new Set());
  const [borradores, setBorradores] = useState<Record<string, string>>({});
  const [redactando, setRedactando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');

  useEffect(() => {
    fetch('/api/ai/admin/reactivacion')
      .then((r) => r.json())
      .then((data) => {
        setCandidatos(data.candidatos ?? []);
        setDisponible(data.iaDisponible);
        setSeleccion(new Set((data.candidatos ?? []).map((c: Candidato) => c.userId)));
      });
  }, []);

  function alternar(id: string) {
    setSeleccion((prev) => {
      const nueva = new Set(prev);
      if (nueva.has(id)) nueva.delete(id);
      else nueva.add(id);
      return nueva;
    });
  }

  async function redactar() {
    setError('');
    setOk('');
    setRedactando(true);
    const res = await fetch('/api/ai/admin/reactivacion', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accion: 'redactar', userIds: Array.from(seleccion) }),
    });
    const data = await res.json();
    setRedactando(false);
    if (!res.ok) {
      setError(data.error);
      return;
    }
    const nuevos: Record<string, string> = {};
    for (const m of data.mensajes as { userId: string; mensaje: string }[]) nuevos[m.userId] = m.mensaje;
    setBorradores(nuevos);
  }

  async function enviar() {
    const mensajes = Object.entries(borradores)
      .filter(([id, texto]) => seleccion.has(id) && texto.trim())
      .map(([userId, mensaje]) => ({ userId, mensaje }));
    if (!mensajes.length) return;

    setError('');
    setEnviando(true);
    const res = await fetch('/api/ai/admin/reactivacion', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accion: 'enviar', mensajes }),
    });
    const data = await res.json();
    setEnviando(false);
    if (!res.ok) {
      setError(data.error);
      return;
    }
    setOk(`${data.enviados} aviso${data.enviados === 1 ? '' : 's'} enviado${data.enviados === 1 ? '' : 's'}. Los verán en su inicio.`);
    // Quitamos de la lista a los que ya han recibido el aviso
    const enviados = new Set(mensajes.map((m) => m.userId));
    setCandidatos((prev) => prev?.filter((c) => !enviados.has(c.userId)) ?? null);
    setBorradores({});
  }

  const hayBorradores = Object.keys(borradores).length > 0;

  return (
    <motion.section variants={fadeUpItem} className="bg-card border border-white/5 rounded-2xl p-5">
      <h2 className="text-[11px] font-bold uppercase tracking-widest text-gray-400 flex items-center gap-1.5 mb-1">
        <FontAwesomeIcon icon={faHandshake} className="w-3 h-3" />
        Socios a reactivar
      </h2>
      <p className="text-xs text-gray-500 mb-4">
        Socios que vienen menos, cancelan tarde, tienen la cuota a punto de vencer o han pedido la baja. La IA
        redacta un aviso para cada uno; tú lo revisas y lo envías.
      </p>

      {candidatos === null ? (
        <div className="space-y-2">
          <Skeleton className="h-14" />
          <Skeleton className="h-14" />
        </div>
      ) : candidatos.length === 0 ? (
        <p className="text-sm text-gray-400 flex items-center gap-2 py-4">
          <FontAwesomeIcon icon={faCircleCheck} className="w-4 h-4 text-accent" />
          Todo en orden: ningún socio necesita un empujón ahora mismo.
        </p>
      ) : (
        <>
          <ul className="space-y-2 mb-4">
            {candidatos.map((c) => (
              <li key={c.userId} className="bg-page/60 rounded-xl p-3">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={seleccion.has(c.userId)}
                    onChange={() => alternar(c.userId)}
                    className="accent-[#C6F135] w-4 h-4 mt-0.5"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-white">{c.nombre}</p>
                    <p className="text-[11px] text-gray-500">{c.motivos.join(' · ')}</p>
                  </div>
                </label>
                <AnimatePresence>
                  {borradores[c.userId] !== undefined && seleccion.has(c.userId) && (
                    <motion.textarea
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      value={borradores[c.userId]}
                      maxLength={500}
                      rows={3}
                      onChange={(e) => setBorradores((b) => ({ ...b, [c.userId]: e.target.value }))}
                      className="mt-3 w-full bg-card border border-white/10 rounded-xl px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-accent/50"
                    />
                  )}
                </AnimatePresence>
              </li>
            ))}
          </ul>

          {error && <p className="text-xs text-danger mb-3">{error}</p>}

          <div className="flex flex-col sm:flex-row gap-2">
            <motion.button
              whileTap={tapScale}
              onClick={redactar}
              disabled={!disponible || redactando || seleccion.size === 0}
              className={clsx(
                'flex-1 text-sm font-bold py-2.5 rounded-xl flex items-center justify-center gap-2 disabled:opacity-40',
                hayBorradores ? 'bg-white/5 text-gray-200 hover:bg-white/10' : 'bg-gradient-accent text-page shadow-glow'
              )}
            >
              <FontAwesomeIcon icon={faWandMagicSparkles} className="w-3.5 h-3.5" />
              {redactando ? 'Redactando…' : hayBorradores ? 'Volver a redactar' : `Redactar con IA (${seleccion.size})`}
            </motion.button>
            {hayBorradores && (
              <motion.button
                whileTap={tapScale}
                onClick={enviar}
                disabled={enviando}
                className="flex-1 bg-gradient-accent text-page text-sm font-bold py-2.5 rounded-xl shadow-glow flex items-center justify-center gap-2 disabled:opacity-40"
              >
                <FontAwesomeIcon icon={faPaperPlane} className="w-3.5 h-3.5" />
                {enviando ? 'Enviando…' : 'Enviar avisos'}
              </motion.button>
            )}
          </div>
          {!disponible && <p className="text-[11px] text-gray-500 mt-2">Activa la IA para redactar los avisos.</p>}
        </>
      )}
      {ok && <p className="text-xs text-accent mt-3">{ok}</p>}
    </motion.section>
  );
}

export default function AdminIAPage() {
  return (
    <div className="min-h-screen bg-page bg-gradient-hero bg-no-repeat p-4 sm:p-8">
      <motion.div variants={staggerContainer} initial="hidden" animate="show" className="max-w-3xl mx-auto">
        <motion.div variants={fadeUpItem} className="mb-6">
          <p className="text-sm font-medium text-accent mb-1">Asistente</p>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">IA del gimnasio</h1>
        </motion.div>
        <ResumenSemanal />
        <Reactivacion />
      </motion.div>
    </div>
  );
}
