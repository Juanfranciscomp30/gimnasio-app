'use client';

import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faCamera,
  faUser,
  faEnvelope,
  faTag,
  faTriangleExclamation,
  faCircleCheck,
} from '@fortawesome/free-solid-svg-icons';
import { staggerContainer, fadeUpItem, hoverLift, tapScale } from '@/lib/motion';
import Skeleton from '@/components/ui/Skeleton';

type Perfil = {
  id: string;
  name: string;
  email: string;
  role: 'ADMIN' | 'USER';
  weeklyPlan: 'ONE_DAY' | 'TWO_DAYS' | 'THREE_DAYS';
  profileImageUrl: string | null;
  cancellationRequested: boolean;
  cancellationRequestedAt: string | null;
};

const ETIQUETA_PLAN: Record<Perfil['weeklyPlan'], string> = {
  ONE_DAY: '1 día/semana',
  TWO_DAYS: '2 días/semana',
  THREE_DAYS: '3 días/semana',
};

export default function PerfilPage() {
  const [perfil, setPerfil] = useState<Perfil | null>(null);
  const [cargando, setCargando] = useState(true);
  const [subiendoFoto, setSubiendoFoto] = useState(false);
  const [procesandoBaja, setProcesandoBaja] = useState(false);
  const [mensaje, setMensaje] = useState('');
  const [error, setError] = useState('');
  const inputFotoRef = useRef<HTMLInputElement>(null);

  async function cargarPerfil() {
    const res = await fetch('/api/users/me');
    if (res.ok) setPerfil(await res.json());
    setCargando(false);
  }

  useEffect(() => {
    cargarPerfil();
  }, []);

  async function subirFoto(e: React.ChangeEvent<HTMLInputElement>) {
    const archivo = e.target.files?.[0];
    if (!archivo) return;
    e.target.value = '';

    setError('');
    setSubiendoFoto(true);
    const formData = new FormData();
    formData.append('file', archivo);

    const res = await fetch('/api/users/me/avatar', { method: 'POST', body: formData });
    const data = await res.json();
    setSubiendoFoto(false);

    if (!res.ok) {
      setError(data.error);
      return;
    }
    setPerfil((prev) => (prev ? { ...prev, profileImageUrl: data.profileImageUrl } : prev));
    window.dispatchEvent(
      new CustomEvent('avatar-actualizado', { detail: { profileImageUrl: data.profileImageUrl } })
    );
  }

  async function quitarFoto() {
    setError('');
    setSubiendoFoto(true);
    const res = await fetch('/api/users/me/avatar', { method: 'DELETE' });
    const data = await res.json();
    setSubiendoFoto(false);
    if (!res.ok) {
      setError(data.error);
      return;
    }
    setPerfil((prev) => (prev ? { ...prev, profileImageUrl: data.profileImageUrl } : prev));
    window.dispatchEvent(
      new CustomEvent('avatar-actualizado', { detail: { profileImageUrl: data.profileImageUrl } })
    );
  }

  async function cambiarSolicitudBaja(solicitar: boolean) {
    setError('');
    setMensaje('');
    setProcesandoBaja(true);
    const res = await fetch('/api/users/me', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cancellationRequested: solicitar }),
    });
    const data = await res.json();
    setProcesandoBaja(false);

    if (!res.ok) {
      setError(data.error);
      return;
    }
    setPerfil(data);
    setMensaje(
      solicitar
        ? 'Baja solicitada. El gimnasio la revisará; mientras tanto no podrás reservar clases nuevas.'
        : 'Has retirado tu solicitud de baja.'
    );
  }

  if (cargando) {
    return (
      <div className="min-h-screen bg-page">
        <div className="max-w-sm sm:max-w-xl mx-auto px-5 pt-6 space-y-3">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-7 w-32 mb-2" />
          <Skeleton className="h-40" />
          <Skeleton className="h-32" />
        </div>
      </div>
    );
  }

  if (!perfil) {
    return (
      <div className="min-h-screen bg-page flex items-center justify-center text-gray-400 text-sm">
        No se ha podido cargar tu perfil.
      </div>
    );
  }

  const inicial = perfil.name.charAt(0).toUpperCase();

  return (
    <div className="min-h-screen bg-page bg-gradient-hero bg-no-repeat pb-24">
      <motion.div
        variants={staggerContainer}
        initial="hidden"
        animate="show"
        className="max-w-sm sm:max-w-xl mx-auto px-5 pt-6"
      >
        <motion.p variants={fadeUpItem} className="text-accent text-[11px] font-semibold tracking-widest uppercase mb-1">
          Tu cuenta
        </motion.p>
        <motion.h1 variants={fadeUpItem} className="text-2xl font-extrabold mb-6 tracking-tight">
          Perfil
        </motion.h1>

        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -8, height: 0 }}
              animate={{ opacity: 1, y: 0, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mb-4 bg-dangersoft border border-danger/30 text-danger text-sm px-4 py-3 rounded-xl flex items-start gap-2 overflow-hidden"
            >
              <FontAwesomeIcon icon={faTriangleExclamation} className="w-3.5 h-3.5 mt-0.5 shrink-0" />
              <span>{error}</span>
            </motion.div>
          )}
          {mensaje && (
            <motion.div
              initial={{ opacity: 0, y: -8, height: 0 }}
              animate={{ opacity: 1, y: 0, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mb-4 bg-accentsoft border border-accent/30 text-accent text-sm px-4 py-3 rounded-xl flex items-start gap-2 overflow-hidden"
            >
              <FontAwesomeIcon icon={faCircleCheck} className="w-3.5 h-3.5 mt-0.5 shrink-0" />
              <span>{mensaje}</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Avatar */}
        <motion.div
          variants={fadeUpItem}
          className="bg-card bg-gradient-card-glow rounded-2xl p-6 flex flex-col items-center gap-3 mb-4"
        >
          <motion.button
            type="button"
            whileHover={{ scale: 1.04 }}
            whileTap={tapScale}
            onClick={() => inputFotoRef.current?.click()}
            className="relative w-24 h-24 rounded-full group"
            aria-label="Cambiar foto de perfil"
          >
            {perfil.profileImageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={perfil.profileImageUrl}
                alt="Foto de perfil"
                className="w-24 h-24 rounded-full object-cover ring-4 ring-accent/20"
              />
            ) : (
              <div className="w-24 h-24 rounded-full bg-accentsoft text-accent flex items-center justify-center text-3xl font-bold ring-4 ring-accent/10">
                {inicial}
              </div>
            )}
            <span className="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-accent text-page flex items-center justify-center shadow-glow group-hover:brightness-95">
              <FontAwesomeIcon icon={faCamera} className="w-3.5 h-3.5" />
            </span>
          </motion.button>

          <input
            ref={inputFotoRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            onChange={subirFoto}
          />

          <div className="flex items-center gap-3">
            <span className="text-xs font-semibold text-accent">
              {subiendoFoto ? 'Subiendo...' : perfil.profileImageUrl ? 'Cambiar foto' : 'Añadir foto'}
            </span>
            {perfil.profileImageUrl && (
              <button
                onClick={quitarFoto}
                disabled={subiendoFoto}
                className="text-xs text-gray-500 hover:text-danger disabled:opacity-50"
              >
                Quitar
              </button>
            )}
          </div>
        </motion.div>

        {/* Datos */}
        <motion.div variants={fadeUpItem} className="bg-card rounded-2xl p-5 space-y-4 mb-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center shrink-0">
              <FontAwesomeIcon icon={faUser} className="w-3.5 h-3.5 text-gray-500" />
            </div>
            <div>
              <p className="text-[11px] text-gray-500 uppercase tracking-wide">Nombre</p>
              <p className="text-sm font-semibold">{perfil.name}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center shrink-0">
              <FontAwesomeIcon icon={faEnvelope} className="w-3.5 h-3.5 text-gray-500" />
            </div>
            <div>
              <p className="text-[11px] text-gray-500 uppercase tracking-wide">Email</p>
              <p className="text-sm font-semibold">{perfil.email}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-accentsoft flex items-center justify-center shrink-0">
              <FontAwesomeIcon icon={faTag} className="w-3.5 h-3.5 text-accent" />
            </div>
            <div>
              <p className="text-[11px] text-gray-500 uppercase tracking-wide">Tarifa</p>
              <p className="text-sm font-semibold">{ETIQUETA_PLAN[perfil.weeklyPlan]}</p>
            </div>
          </div>
        </motion.div>

        {/* Baja */}
        <motion.div variants={fadeUpItem} className="bg-card rounded-2xl p-5">
          <h2 className="text-sm font-bold mb-1">Baja del gimnasio</h2>

          <AnimatePresence mode="wait">
            {perfil.cancellationRequested ? (
              <motion.div
                key="con-baja"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <p className="text-xs text-gray-400 mb-3">
                  Solicitaste la baja
                  {perfil.cancellationRequestedAt &&
                    ` el ${new Date(perfil.cancellationRequestedAt).toLocaleDateString('es-ES')}`}
                  . No puedes reservar clases nuevas mientras esté pendiente de revisión; tus
                  reservas ya confirmadas se mantienen.
                </p>
                <motion.button
                  whileHover={hoverLift}
                  whileTap={tapScale}
                  onClick={() => cambiarSolicitudBaja(false)}
                  disabled={procesandoBaja}
                  className="w-full bg-white/5 text-gray-200 text-sm font-semibold py-2.5 rounded-xl hover:bg-white/10 disabled:opacity-50"
                >
                  {procesandoBaja ? 'Procesando...' : 'Retirar solicitud'}
                </motion.button>
              </motion.div>
            ) : (
              <motion.div
                key="sin-baja"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <p className="text-xs text-gray-400 mb-3">
                  Si ya no quieres seguir en el gimnasio, puedes solicitar la baja. En cuanto la
                  pidas dejarás de poder reservar clases nuevas hasta que el gimnasio la
                  confirme.
                </p>
                <motion.button
                  whileHover={hoverLift}
                  whileTap={tapScale}
                  onClick={() => cambiarSolicitudBaja(true)}
                  disabled={procesandoBaja}
                  className="w-full bg-dangersoft text-danger text-sm font-semibold py-2.5 rounded-xl hover:bg-danger/20 disabled:opacity-50"
                >
                  {procesandoBaja ? 'Procesando...' : 'Solicitar baja'}
                </motion.button>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </motion.div>
    </div>
  );
}
