'use client';

import { useEffect, useRef, useState } from 'react';

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
    return <div className="min-h-screen bg-page" />;
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
    <div className="min-h-screen bg-page pb-24">
      <div className="max-w-sm mx-auto px-5 pt-6">
        <p className="text-accent text-[11px] font-semibold tracking-widest uppercase mb-1">
          Tu cuenta
        </p>
        <h1 className="text-xl font-extrabold mb-6">Perfil</h1>

        {error && (
          <div className="mb-4 bg-dangersoft border border-danger/30 text-danger text-sm px-4 py-3 rounded-xl">
            {error}
          </div>
        )}
        {mensaje && (
          <div className="mb-4 bg-accentsoft border border-accent/30 text-accent text-sm px-4 py-3 rounded-xl">
            {mensaje}
          </div>
        )}

        {/* Avatar */}
        <div className="bg-card rounded-2xl p-6 flex flex-col items-center gap-3 mb-4">
          <div className="relative w-20 h-20">
            {perfil.profileImageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={perfil.profileImageUrl}
                alt="Foto de perfil"
                className="w-20 h-20 rounded-full object-cover"
              />
            ) : (
              <div className="w-20 h-20 rounded-full bg-accent/15 text-accent flex items-center justify-center text-2xl font-bold">
                {inicial}
              </div>
            )}
          </div>

          <input
            ref={inputFotoRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            onChange={subirFoto}
          />

          <div className="flex items-center gap-3">
            <button
              onClick={() => inputFotoRef.current?.click()}
              disabled={subiendoFoto}
              className="text-xs font-semibold text-accent hover:underline disabled:opacity-50"
            >
              {subiendoFoto ? 'Subiendo...' : perfil.profileImageUrl ? 'Cambiar foto' : 'Añadir foto'}
            </button>
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
        </div>

        {/* Datos */}
        <div className="bg-card rounded-2xl p-5 space-y-3 mb-4">
          <div>
            <p className="text-[11px] text-gray-500 uppercase tracking-wide">Nombre</p>
            <p className="text-sm font-semibold">{perfil.name}</p>
          </div>
          <div>
            <p className="text-[11px] text-gray-500 uppercase tracking-wide">Email</p>
            <p className="text-sm font-semibold">{perfil.email}</p>
          </div>
          <div>
            <p className="text-[11px] text-gray-500 uppercase tracking-wide">Tarifa</p>
            <p className="text-sm font-semibold">{ETIQUETA_PLAN[perfil.weeklyPlan]}</p>
          </div>
        </div>

        {/* Baja */}
        <div className="bg-card rounded-2xl p-5">
          <h2 className="text-sm font-bold mb-1">Baja del gimnasio</h2>

          {perfil.cancellationRequested ? (
            <>
              <p className="text-xs text-gray-400 mb-3">
                Solicitaste la baja
                {perfil.cancellationRequestedAt &&
                  ` el ${new Date(perfil.cancellationRequestedAt).toLocaleDateString('es-ES')}`}
                . No puedes reservar clases nuevas mientras esté pendiente de revisión; tus
                reservas ya confirmadas se mantienen.
              </p>
              <button
                onClick={() => cambiarSolicitudBaja(false)}
                disabled={procesandoBaja}
                className="w-full bg-white/5 text-gray-200 text-sm font-semibold py-2 rounded-xl hover:bg-white/10 disabled:opacity-50"
              >
                {procesandoBaja ? 'Procesando...' : 'Retirar solicitud'}
              </button>
            </>
          ) : (
            <>
              <p className="text-xs text-gray-400 mb-3">
                Si ya no quieres seguir en el gimnasio, puedes solicitar la baja. En cuanto la
                pidas dejarás de poder reservar clases nuevas hasta que el gimnasio la
                confirme.
              </p>
              <button
                onClick={() => cambiarSolicitudBaja(true)}
                disabled={procesandoBaja}
                className="w-full bg-dangersoft text-danger text-sm font-semibold py-2 rounded-xl hover:bg-danger/20 disabled:opacity-50"
              >
                {procesandoBaja ? 'Procesando...' : 'Solicitar baja'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
