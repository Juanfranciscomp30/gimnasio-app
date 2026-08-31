'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { staggerContainer, fadeUpItem, hoverLift, tapScale } from '@/lib/motion';

type Usuario = {
  id: string;
  name: string;
  email: string;
  role: 'ADMIN' | 'USER';
  weeklyPlan: 'ONE_DAY' | 'TWO_DAYS' | 'THREE_DAYS';
  createdByAdmin: boolean;
  tieneAcceso: boolean;
  cancellationRequested: boolean;
  cancellationRequestedAt: string | null;
  profileImageUrl: string | null;
};

type Pago = {
  userId: string;
  validUntil: string;
  paidAt: string;
};

const ETIQUETA_PLAN: Record<Usuario['weeklyPlan'], string> = {
  ONE_DAY: '1 día/semana',
  TWO_DAYS: '2 días/semana',
  THREE_DAYS: '3 días/semana',
};

// Mismo cálculo que en /admin/pagos, para no depender de otra pestaña
function vencePronto(validUntil: Date, diasAviso = 3) {
  const msRestantes = validUntil.getTime() - Date.now();
  const diasRestantes = msRestantes / (1000 * 60 * 60 * 24);
  return diasRestantes >= 0 && diasRestantes <= diasAviso;
}

export default function UsuariosAdminPage() {
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [pagos, setPagos] = useState<Pago[]>([]);
  const [busqueda, setBusqueda] = useState('');
  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [plan, setPlan] = useState<Usuario['weeklyPlan']>('ONE_DAY');
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);
  const [actualizandoId, setActualizandoId] = useState<string | null>(null);

  async function cargarUsuarios() {
    const [resUsuarios, resPagos] = await Promise.all([
      fetch('/api/users'),
      fetch('/api/payments'),
    ]);
    if (resUsuarios.ok) setUsuarios(await resUsuarios.json());
    if (resPagos.ok) setPagos(await resPagos.json());
  }

  useEffect(() => {
    cargarUsuarios();
  }, []);

  function ultimoPagoDe(userId: string): Pago | undefined {
    return pagos
      .filter((p) => p.userId === userId)
      .sort((a, b) => new Date(b.paidAt).getTime() - new Date(a.paidAt).getTime())[0];
  }

  const usuariosFiltrados = usuarios.filter((u) => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return true;
    return u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
  });

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

  // accion: 'confirmarBaja' revoca el acceso del usuario de verdad,
  // 'rechazarBaja' solo descarta la solicitud y deja todo como estaba
  async function procesarBaja(id: string, accion: 'confirmarBaja' | 'rechazarBaja') {
    setActualizandoId(id);
    await fetch(`/api/users/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accion }),
    });
    setActualizandoId(null);
    cargarUsuarios();
  }

  return (
    <div className="min-h-screen bg-page bg-gradient-hero bg-no-repeat p-4 sm:p-8">
    <motion.div
      variants={staggerContainer}
      initial="hidden"
      animate="show"
      className="max-w-3xl mx-auto"
    >
      <motion.h1 variants={fadeUpItem} className="text-2xl sm:text-3xl font-extrabold mb-6 tracking-tight">
        Usuarios
      </motion.h1>

      {/* Alta manual */}
      <motion.form
        variants={fadeUpItem}
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

        <motion.button
          type="submit"
          disabled={cargando}
          whileHover={hoverLift}
          whileTap={tapScale}
          className="bg-gradient-accent text-page font-bold px-5 py-2 rounded-xl text-sm shadow-glow disabled:opacity-50"
        >
          {cargando ? 'Añadiendo...' : 'Añadir usuario'}
        </motion.button>
      </motion.form>

      {/* Buscador */}
      <motion.input
        variants={fadeUpItem}
        type="text"
        value={busqueda}
        onChange={(e) => setBusqueda(e.target.value)}
        placeholder="Buscar por nombre o email..."
        className="w-full bg-card border border-white/10 rounded-xl px-4 py-2.5 text-sm placeholder:text-gray-600 focus:outline-none focus:border-accent/60 focus:ring-2 focus:ring-accent/20 transition mb-4"
      />

      {/* Listado */}
      <motion.div variants={staggerContainer} className="space-y-2">
        {usuariosFiltrados.length === 0 && (
          <p className="text-gray-500 text-sm py-4 text-center">Ningún usuario coincide con la búsqueda.</p>
        )}
        <AnimatePresence>
        {usuariosFiltrados.map((u) => {
          const ultimoPago = ultimoPagoDe(u.id);
          const validUntilDate = ultimoPago ? new Date(ultimoPago.validUntil) : null;
          const vencido = validUntilDate ? validUntilDate < new Date() : false;
          const proximoAVencer = validUntilDate && !vencido ? vencePronto(validUntilDate) : false;
          const nuncaPago = !ultimoPago;

          return (
          <motion.div
            key={u.id}
            layout
            variants={fadeUpItem}
            exit={{ opacity: 0, x: -12 }}
            whileHover={hoverLift}
            className="bg-card p-4 rounded-2xl flex flex-wrap items-center justify-between gap-3"
          >
            <div className="flex items-center gap-3">
              {u.profileImageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={u.profileImageUrl}
                  alt=""
                  className="w-9 h-9 rounded-full object-cover shrink-0"
                />
              ) : (
                <div className="w-9 h-9 rounded-full bg-white/5 text-gray-400 flex items-center justify-center text-xs font-bold shrink-0">
                  {u.name.charAt(0).toUpperCase()}
                </div>
              )}
              <div>
              <p className="font-semibold text-sm flex items-center gap-2 flex-wrap">
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
                {u.cancellationRequested && (
                  <span className="text-[10px] font-bold bg-dangersoft text-danger px-2 py-0.5 rounded-full">
                    BAJA SOLICITADA
                  </span>
                )}
                {nuncaPago && (
                  <span className="text-[10px] font-bold bg-white/5 text-gray-400 px-2 py-0.5 rounded-full">
                    SIN PAGOS
                  </span>
                )}
                {vencido && (
                  <span className="text-[10px] font-bold bg-dangersoft text-danger px-2 py-0.5 rounded-full">
                    CUOTA VENCIDA
                  </span>
                )}
                {proximoAVencer && (
                  <span className="text-[10px] font-bold bg-amber-400/10 text-amber-400 px-2 py-0.5 rounded-full">
                    VENCE PRONTO
                  </span>
                )}
                {ultimoPago && !vencido && !proximoAVencer && (
                  <span className="text-[10px] font-bold bg-accentsoft text-accent px-2 py-0.5 rounded-full">
                    AL DÍA
                  </span>
                )}
              </p>
              <p className="text-xs text-gray-500">{u.email}</p>
              {u.cancellationRequested && (
                <div className="flex items-center gap-2 mt-2">
                  <button
                    onClick={() => procesarBaja(u.id, 'confirmarBaja')}
                    disabled={actualizandoId === u.id}
                    className="text-[11px] font-semibold bg-danger/15 text-danger hover:bg-danger/25 px-2.5 py-1 rounded-lg disabled:opacity-50"
                  >
                    Confirmar baja
                  </button>
                  <button
                    onClick={() => procesarBaja(u.id, 'rechazarBaja')}
                    disabled={actualizandoId === u.id}
                    className="text-[11px] font-semibold bg-white/5 hover:bg-white/10 px-2.5 py-1 rounded-lg disabled:opacity-50"
                  >
                    Descartar
                  </button>
                </div>
              )}
              </div>
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
          </motion.div>
          );
        })}
        </AnimatePresence>
      </motion.div>
    </motion.div>
    </div>
  );
}
