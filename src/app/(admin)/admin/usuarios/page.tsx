'use client';

import { useEffect, useState } from 'react';

type Usuario = {
  id: string;
  name: string;
  email: string;
  role: 'ADMIN' | 'USER';
  weeklyPlan: 'ONE_DAY' | 'TWO_DAYS' | 'THREE_DAYS';
  createdByAdmin: boolean;
  tieneAcceso: boolean;
};

const ETIQUETA_PLAN: Record<Usuario['weeklyPlan'], string> = {
  ONE_DAY: '1 día/semana',
  TWO_DAYS: '2 días/semana',
  THREE_DAYS: '3 días/semana',
};

export default function UsuariosAdminPage() {
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [plan, setPlan] = useState<Usuario['weeklyPlan']>('ONE_DAY');
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);
  const [actualizandoId, setActualizandoId] = useState<string | null>(null);

  async function cargarUsuarios() {
    const res = await fetch('/api/users');
    if (res.ok) setUsuarios(await res.json());
  }

  useEffect(() => {
    cargarUsuarios();
  }, []);

  async function handleAltaManual(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setCargando(true);

    const res = await fetch('/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: nombre, email, weeklyPlan: plan }),
    });
    const data = await res.json();
    setCargando(false);

    if (!res.ok) {
      setError(data.error);
      return;
    }

    setNombre('');
    setEmail('');
    setPlan('ONE_DAY');
    cargarUsuarios();
  }

  async function cambiarPlan(id: string, nuevoPlan: Usuario['weeklyPlan']) {
    setActualizandoId(id);
    await fetch(`/api/users/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ weeklyPlan: nuevoPlan }),
    });
    setActualizandoId(null);
    cargarUsuarios();
  }

  async function cambiarRol(id: string, nuevoRol: Usuario['role']) {
    setActualizandoId(id);
    await fetch(`/api/users/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: nuevoRol }),
    });
    setActualizandoId(null);
    cargarUsuarios();
  }

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <h1 className="text-2xl font-extrabold mb-6">Usuarios</h1>

      {/* Alta manual */}
      <form
        onSubmit={handleAltaManual}
        className="bg-card p-6 rounded-2xl mb-8 space-y-4"
      >
        <h2 className="font-bold text-sm text-gray-300">Añadir usuario manualmente</h2>
        <p className="text-xs text-gray-500 -mt-2">
          Se crea sin contraseña: la persona aún no podrá iniciar sesión hasta que active su cuenta.
        </p>

        {error && (
          <p className="text-danger text-sm bg-dangersoft border border-danger/30 px-3 py-2 rounded-xl">
            {error}
          </p>
        )}

        <div className="flex flex-wrap gap-3">
          <input
            type="text"
            placeholder="Nombre"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            required
            className="flex-1 min-w-[140px] bg-page border border-white/10 rounded-xl px-3 py-2 text-sm placeholder:text-gray-600 focus:outline-none focus:border-accent/60"
          />
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="flex-1 min-w-[180px] bg-page border border-white/10 rounded-xl px-3 py-2 text-sm placeholder:text-gray-600 focus:outline-none focus:border-accent/60"
          />
          <select
            value={plan}
            onChange={(e) => setPlan(e.target.value as Usuario['weeklyPlan'])}
            className="bg-page border border-white/10 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-accent/60"
          >
            <option value="ONE_DAY">1 día/semana</option>
            <option value="TWO_DAYS">2 días/semana</option>
            <option value="THREE_DAYS">3 días/semana</option>
          </select>
        </div>

        <button
          type="submit"
          disabled={cargando}
          className="bg-accent text-page font-bold px-5 py-2 rounded-xl text-sm hover:brightness-95 disabled:opacity-50"
        >
          {cargando ? 'Añadiendo...' : 'Añadir usuario'}
        </button>
      </form>

      {/* Listado */}
      <div className="space-y-2">
        {usuarios.map((u) => (
          <div
            key={u.id}
            className="bg-card p-4 rounded-2xl flex flex-wrap items-center justify-between gap-3"
          >
            <div>
              <p className="font-semibold text-sm flex items-center gap-2">
                {u.name}
                {u.role === 'ADMIN' && (
                  <span className="text-[10px] font-bold bg-accentsoft text-accent px-2 py-0.5 rounded-full">
                    ADMIN
                  </span>
                )}
                {!u.tieneAcceso && (
                  <span className="text-[10px] font-bold bg-white/5 text-gray-400 px-2 py-0.5 rounded-full">
                    SIN ACCESO
                  </span>
                )}
              </p>
              <p className="text-xs text-gray-500">{u.email}</p>
            </div>

            <div className="flex items-center gap-2">
              <select
                value={u.weeklyPlan}
                disabled={actualizandoId === u.id}
                onChange={(e) => cambiarPlan(u.id, e.target.value as Usuario['weeklyPlan'])}
                className="bg-page border border-white/10 rounded-lg px-2 py-1.5 text-xs disabled:opacity-50"
              >
                <option value="ONE_DAY">1 día/semana</option>
                <option value="TWO_DAYS">2 días/semana</option>
                <option value="THREE_DAYS">3 días/semana</option>
              </select>

              <button
                onClick={() => cambiarRol(u.id, u.role === 'ADMIN' ? 'USER' : 'ADMIN')}
                disabled={actualizandoId === u.id}
                className="text-xs font-semibold bg-white/5 hover:bg-white/10 px-3 py-1.5 rounded-lg disabled:opacity-50"
              >
                {u.role === 'ADMIN' ? 'Quitar admin' : 'Hacer admin'}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
