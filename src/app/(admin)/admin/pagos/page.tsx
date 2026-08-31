'use client';

import { useEffect, useState } from 'react';

type Usuario = {
  id: string;
  name: string;
  email: string;
  weeklyPlan: 'ONE_DAY' | 'TWO_DAYS' | 'THREE_DAYS';
};

type Pago = {
  id: string;
  userId: string;
  amount: number;
  paidAt: string;
  validUntil: string;
  weeklyPlan: 'ONE_DAY' | 'TWO_DAYS' | 'THREE_DAYS';
  user: { id: string; name: string; email: string };
};

type Gasto = {
  id: string;
  concept: string;
  amount: number;
  category: string | null;
  date: string;
};

const PRECIO_POR_PLAN: Record<Usuario['weeklyPlan'], number> = {
  ONE_DAY: 25,
  TWO_DAYS: 40,
  THREE_DAYS: 55,
};

const ETIQUETA_PLAN: Record<Usuario['weeklyPlan'], string> = {
  ONE_DAY: '1 día/semana',
  TWO_DAYS: '2 días/semana',
  THREE_DAYS: '3 días/semana',
};

// Mismo cálculo que en el backend (src/lib/payment-logic.ts), aquí en
// el cliente para pintar los badges sin tener que llamar a otra API.
function vencePronto(validUntil: Date, diasAviso = 3) {
  const msRestantes = validUntil.getTime() - Date.now();
  const diasRestantes = msRestantes / (1000 * 60 * 60 * 24);
  return diasRestantes >= 0 && diasRestantes <= diasAviso;
}

export default function PagosAdminPage() {
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [pagos, setPagos] = useState<Pago[]>([]);
  const [registrando, setRegistrando] = useState<string | null>(null);
  const [filtroHistorial, setFiltroHistorial] = useState('');

  const [gastos, setGastos] = useState<Gasto[]>([]);
  const [conceptoGasto, setConceptoGasto] = useState('');
  const [importeGasto, setImporteGasto] = useState('');
  const [categoriaGasto, setCategoriaGasto] = useState('');
  const [guardandoGasto, setGuardandoGasto] = useState(false);
  const [errorGasto, setErrorGasto] = useState('');
  const [gastoAEliminar, setGastoAEliminar] = useState<string | null>(null);
  const [eliminandoGasto, setEliminandoGasto] = useState(false);

  async function cargarDatos() {
    const [resUsuarios, resPagos, resGastos] = await Promise.all([
      fetch('/api/users'),
      fetch('/api/payments'),
      fetch('/api/expenses'),
    ]);
    if (resUsuarios.ok) setUsuarios(await resUsuarios.json());
    if (resPagos.ok) setPagos(await resPagos.json());
    if (resGastos.ok) setGastos(await resGastos.json());
  }

  useEffect(() => {
    cargarDatos();
  }, []);

  async function agregarGasto() {
    setErrorGasto('');
    const importe = Number(importeGasto.replace(',', '.'));
    if (!conceptoGasto.trim()) {
      setErrorGasto('Escribe un concepto');
      return;
    }
    if (!importe || importe <= 0) {
      setErrorGasto('Escribe un importe válido');
      return;
    }

    setGuardandoGasto(true);
    const res = await fetch('/api/expenses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        concept: conceptoGasto.trim(),
        amount: importe,
        category: categoriaGasto.trim() || undefined,
      }),
    });
    setGuardandoGasto(false);

    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setErrorGasto(data?.error ?? 'No se ha podido guardar el gasto');
      return;
    }

    setConceptoGasto('');
    setImporteGasto('');
    setCategoriaGasto('');
    cargarDatos();
  }

  async function eliminarGasto(id: string) {
    setEliminandoGasto(true);
    await fetch(`/api/expenses/${id}`, { method: 'DELETE' });
    setEliminandoGasto(false);
    setGastoAEliminar(null);
    setGastos((actuales) => actuales.filter((g) => g.id !== id));
  }

  function ultimoPagoDe(userId: string): Pago | undefined {
    return pagos
      .filter((p) => p.userId === userId)
      .sort((a, b) => new Date(b.paidAt).getTime() - new Date(a.paidAt).getTime())[0];
  }

  async function registrarPago(userId: string) {
    setRegistrando(userId);
    await fetch('/api/payments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId }),
    });
    setRegistrando(null);
    cargarDatos();
  }

  const ahora = new Date();
  const ingresosMes = pagos
    .filter((p) => {
      const d = new Date(p.paidAt);
      return d.getFullYear() === ahora.getFullYear() && d.getMonth() === ahora.getMonth();
    })
    .reduce((suma, p) => suma + p.amount, 0);

  const gastosMes = gastos
    .filter((g) => {
      const d = new Date(g.date);
      return d.getFullYear() === ahora.getFullYear() && d.getMonth() === ahora.getMonth();
    })
    .reduce((suma, g) => suma + g.amount, 0);

  const beneficioMes = ingresosMes - gastosMes;

  const pagosFiltrados = pagos.filter((p) =>
    p.user.name.toLowerCase().includes(filtroHistorial.trim().toLowerCase())
  );

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <h1 className="text-2xl font-extrabold mb-6">Pagos</h1>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <div className="bg-card rounded-2xl p-4">
          <p className="text-[11px] font-bold uppercase tracking-widest text-gray-500 mb-1">
            Ingresos este mes
          </p>
          <p className="text-2xl font-extrabold">{ingresosMes}€</p>
        </div>
        <div className="bg-card rounded-2xl p-4">
          <p className="text-[11px] font-bold uppercase tracking-widest text-gray-500 mb-1">
            Gastos este mes
          </p>
          <p className="text-2xl font-extrabold text-danger">{gastosMes}€</p>
        </div>
        <div className="bg-card rounded-2xl p-4">
          <p className="text-[11px] font-bold uppercase tracking-widest text-gray-500 mb-1">
            Beneficio neto
          </p>
          <p className={`text-2xl font-extrabold ${beneficioMes >= 0 ? 'text-accent' : 'text-danger'}`}>
            {beneficioMes}€
          </p>
        </div>
        <div className="bg-card rounded-2xl p-4">
          <p className="text-[11px] font-bold uppercase tracking-widest text-gray-500 mb-1">
            Pagos registrados
          </p>
          <p className="text-2xl font-extrabold">{pagos.length}</p>
        </div>
      </div>

      <div className="space-y-2">
        {usuarios.map((u) => {
          const ultimoPago = ultimoPagoDe(u.id);
          const validUntilDate = ultimoPago ? new Date(ultimoPago.validUntil) : null;
          const vencido = validUntilDate ? validUntilDate < new Date() : false;
          const proximoAVencer = validUntilDate && !vencido ? vencePronto(validUntilDate) : false;
          const nuncaPago = !ultimoPago;

          return (
            <div
              key={u.id}
              className="bg-card p-4 rounded-2xl flex flex-wrap items-center justify-between gap-3"
            >
              <div>
                <p className="font-semibold text-sm flex items-center gap-2">
                  {u.name}
                  {nuncaPago && (
                    <span className="text-[10px] font-bold bg-white/5 text-gray-400 px-2 py-0.5 rounded-full">
                      SIN PAGOS
                    </span>
                  )}
                  {vencido && (
                    <span className="text-[10px] font-bold bg-dangersoft text-danger px-2 py-0.5 rounded-full">
                      VENCIDO
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
                <p className="text-xs text-gray-500">
                  {ETIQUETA_PLAN[u.weeklyPlan]} · {PRECIO_POR_PLAN[u.weeklyPlan]}€/mes
                  {ultimoPago && (
                    <>
                      {' '}
                      · Válido hasta{' '}
                      {new Date(ultimoPago.validUntil).toLocaleDateString('es-ES')}
                    </>
                  )}
                </p>
              </div>

              <button
                onClick={() => registrarPago(u.id)}
                disabled={registrando === u.id}
                className="bg-accent text-page text-xs font-bold px-4 py-2 rounded-xl hover:brightness-95 disabled:opacity-50"
              >
                {registrando === u.id
                  ? 'Registrando...'
                  : `Registrar pago (${PRECIO_POR_PLAN[u.weeklyPlan]}€)`}
              </button>
            </div>
          );
        })}
      </div>

      <div className="flex items-center justify-between mt-10 mb-3">
        <h2 className="font-bold text-sm text-gray-300">Historial de pagos</h2>
        <input
          type="text"
          value={filtroHistorial}
          onChange={(e) => setFiltroHistorial(e.target.value)}
          placeholder="Filtrar por usuario..."
          className="bg-card border border-white/10 rounded-lg px-3 py-1.5 text-xs placeholder:text-gray-600 focus:outline-none focus:border-accent/60"
        />
      </div>
      <div className="space-y-1">
        {pagos.length === 0 && (
          <p className="text-gray-500 text-sm">Todavía no hay pagos registrados.</p>
        )}
        {pagos.length > 0 && pagosFiltrados.length === 0 && (
          <p className="text-gray-500 text-sm">Ningún pago coincide con ese usuario.</p>
        )}
        {pagosFiltrados.map((p) => (
          <div
            key={p.id}
            className="bg-card/50 px-4 py-2 rounded-xl flex justify-between text-xs text-gray-400"
          >
            <span>{p.user.name}</span>
            <span>{new Date(p.paidAt).toLocaleDateString('es-ES')}</span>
            <span className="text-gray-300 font-semibold">{p.amount}€</span>
          </div>
        ))}
      </div>

      {/* Gastos del gimnasio: luz, maquinaria, etc. Independiente de los
          pagos de los usuarios, es la contabilidad de costes del negocio. */}
      <h2 className="font-bold text-sm text-gray-300 mt-10 mb-3">Gastos</h2>

      <div className="bg-card rounded-2xl p-4 mb-4">
        <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] gap-2 mb-2">
          <input
            type="text"
            value={conceptoGasto}
            onChange={(e) => setConceptoGasto(e.target.value)}
            placeholder="Concepto (ej: Factura de la luz)"
            className="bg-page border border-white/10 rounded-xl px-3 py-2 text-sm placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-accent/50"
          />
          <input
            type="text"
            value={categoriaGasto}
            onChange={(e) => setCategoriaGasto(e.target.value)}
            placeholder="Categoría (opcional)"
            className="bg-page border border-white/10 rounded-xl px-3 py-2 text-sm placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-accent/50"
          />
          <input
            type="text"
            inputMode="decimal"
            value={importeGasto}
            onChange={(e) => setImporteGasto(e.target.value)}
            placeholder="Importe €"
            className="sm:w-28 bg-page border border-white/10 rounded-xl px-3 py-2 text-sm placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-accent/50"
          />
        </div>
        {errorGasto && <p className="text-danger text-xs mb-2">{errorGasto}</p>}
        <button
          onClick={agregarGasto}
          disabled={guardandoGasto}
          className="w-full sm:w-auto bg-accent text-page text-xs font-bold px-4 py-2 rounded-xl hover:brightness-95 disabled:opacity-50"
        >
          {guardandoGasto ? 'Guardando...' : 'Añadir gasto'}
        </button>
      </div>

      <div className="space-y-1 mb-8">
        {gastos.length === 0 && (
          <p className="text-gray-500 text-sm">Todavía no hay gastos registrados.</p>
        )}
        {gastos.map((g) => (
          <div
            key={g.id}
            className="bg-card/50 px-4 py-2 rounded-xl flex items-center justify-between gap-3 text-xs text-gray-400"
          >
            <div className="min-w-0">
              <p className="text-gray-300 font-semibold truncate">
                {g.concept}
                {g.category && <span className="text-gray-500 font-normal"> · {g.category}</span>}
              </p>
              <p>{new Date(g.date).toLocaleDateString('es-ES')}</p>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <span className="text-danger font-semibold">-{g.amount}€</span>
              {gastoAEliminar === g.id ? (
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => eliminarGasto(g.id)}
                    disabled={eliminandoGasto}
                    className="text-danger font-bold disabled:opacity-50"
                  >
                    Sí
                  </button>
                  <button onClick={() => setGastoAEliminar(null)} className="text-gray-500">
                    No
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setGastoAEliminar(g.id)}
                  className="text-gray-600 hover:text-danger"
                  aria-label="Eliminar gasto"
                >
                  Eliminar
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}