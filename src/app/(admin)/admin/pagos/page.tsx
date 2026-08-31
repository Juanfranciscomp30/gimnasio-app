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

  async function cargarDatos() {
    const [resUsuarios, resPagos] = await Promise.all([
      fetch('/api/users'),
      fetch('/api/payments'),
    ]);
    if (resUsuarios.ok) setUsuarios(await resUsuarios.json());
    if (resPagos.ok) setPagos(await resPagos.json());
  }

  useEffect(() => {
    cargarDatos();
  }, []);

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

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <h1 className="text-2xl font-extrabold mb-6">Pagos</h1>

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

      <h2 className="font-bold text-sm text-gray-300 mt-10 mb-3">Historial de pagos</h2>
      <div className="space-y-1">
        {pagos.length === 0 && (
          <p className="text-gray-500 text-sm">Todavía no hay pagos registrados.</p>
        )}
        {pagos.map((p) => (
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
    </div>
  );
}