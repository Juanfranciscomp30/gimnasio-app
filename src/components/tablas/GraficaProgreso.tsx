'use client';

import { useEffect, useRef, useState } from 'react';
import { fechaCorta, kg, type ProgresoEjercicio } from './tipos';

// Gráfica de línea del peso máximo por sesión de un ejercicio. SVG a mano
// (sin librería) para no añadir dependencias: una sola serie, eje Y en kg,
// tooltip al pasar el dedo/ratón por cada punto.
const ALTO = 200;
const M = { top: 16, right: 16, bottom: 28, left: 40 };

function ticksBonitos(min: number, max: number, cuantos = 4): number[] {
  const rango = Math.max(max - min, 1);
  const pasoBruto = rango / cuantos;
  const mag = Math.pow(10, Math.floor(Math.log10(pasoBruto)));
  const paso = [1, 2, 2.5, 5, 10].map((f) => f * mag).find((p) => p >= pasoBruto) ?? mag * 10;
  const inicio = Math.floor(min / paso) * paso;
  const ticks: number[] = [];
  for (let v = inicio; v <= max + paso * 0.001; v += paso) ticks.push(Number(v.toFixed(2)));
  if (ticks[ticks.length - 1] < max) ticks.push(ticks[ticks.length - 1] + paso);
  return ticks;
}

export default function GraficaProgreso({ ejercicio }: { ejercicio: ProgresoEjercicio }) {
  const [activo, setActivo] = useState<number | null>(null);
  // Dibujamos al ancho real del contenedor (en vez de escalar un viewBox
  // fijo) para que los textos de los ejes no se vean diminutos en el móvil.
  const contenedor = useRef<HTMLDivElement>(null);
  const [ancho, setAncho] = useState(340);
  useEffect(() => {
    const el = contenedor.current;
    if (!el) return;
    const obs = new ResizeObserver(([entrada]) => setAncho(Math.max(240, entrada.contentRect.width)));
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  const sesiones = ejercicio.sesiones;
  const pesos = sesiones.map((s) => s.maxWeight);

  const ticks = ticksBonitos(Math.min(...pesos) * 0.9, Math.max(...pesos));
  const yMin = ticks[0];
  const yMax = ticks[ticks.length - 1];
  const anchoUtil = ancho - M.left - M.right;
  const altoUtil = ALTO - M.top - M.bottom;

  const x = (i: number) => M.left + (sesiones.length === 1 ? anchoUtil / 2 : (i / (sesiones.length - 1)) * anchoUtil);
  const y = (v: number) => M.top + altoUtil - ((v - yMin) / (yMax - yMin || 1)) * altoUtil;

  const puntos = sesiones.map((s, i) => ({ px: x(i), py: y(s.maxWeight), s }));
  const linea = puntos.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.px},${p.py}`).join(' ');
  const area = `${linea} L${puntos[puntos.length - 1].px},${M.top + altoUtil} L${puntos[0].px},${M.top + altoUtil} Z`;

  // Etiquetas de fecha: primera, última y alguna intermedia si caben
  const cadaN = Math.max(1, Math.ceil(sesiones.length / Math.max(2, Math.floor(ancho / 90))));
  const sel = activo !== null ? puntos[activo] : null;
  const arriba = sel ? sel.py > 80 : true; // tooltip encima del punto si hay sitio

  return (
    <div ref={contenedor} className="relative">
      <svg
        width={ancho}
        height={ALTO}
        className="block select-none"
        role="img"
        aria-label={`Peso máximo por sesión en ${ejercicio.name}`}
        onMouseLeave={() => setActivo(null)}
      >
        <defs>
          <linearGradient id="grad-progreso" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#C6F135" stopOpacity="0.18" />
            <stop offset="100%" stopColor="#C6F135" stopOpacity="0" />
          </linearGradient>
        </defs>

        {ticks.map((t) => (
          <g key={t}>
            <line x1={M.left} x2={ancho - M.right} y1={y(t)} y2={y(t)} stroke="rgba(255,255,255,0.06)" />
            <text x={M.left - 8} y={y(t) + 4} textAnchor="end" fontSize="11" fill="#6B7280">
              {kg(t)}
            </text>
          </g>
        ))}

        {sesiones.map((s, i) =>
          i % cadaN === 0 || i === sesiones.length - 1 ? (
            <text key={s.date} x={x(i)} y={ALTO - 8} textAnchor="middle" fontSize="11" fill="#6B7280">
              {fechaCorta(s.date)}
            </text>
          ) : null
        )}

        {sesiones.length > 1 && <path d={area} fill="url(#grad-progreso)" />}
        {sesiones.length > 1 && (
          <path d={linea} fill="none" stroke="#C6F135" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        )}

        {sel && (
          <line x1={sel.px} x2={sel.px} y1={M.top} y2={M.top + altoUtil} stroke="rgba(255,255,255,0.15)" />
        )}

        {puntos.map((p, i) => (
          <g key={p.s.date}>
            <circle
              cx={p.px}
              cy={p.py}
              r={activo === i ? 6 : 4}
              fill="#C6F135"
              stroke="#1A1D23"
              strokeWidth="2"
            />
            {/* Zona táctil más grande que el punto */}
            <rect
              x={p.px - anchoUtil / Math.max(sesiones.length, 1) / 2}
              y={M.top}
              width={Math.max(anchoUtil / Math.max(sesiones.length, 1), 16)}
              height={altoUtil}
              fill="transparent"
              onMouseEnter={() => setActivo(i)}
              onTouchStart={() => setActivo(i)}
              onClick={() => setActivo(i)}
            />
          </g>
        ))}
      </svg>

      {sel && (
        <div
          className={`pointer-events-none absolute -translate-x-1/2 bg-page border border-white/10 rounded-lg px-2.5 py-1.5 text-xs shadow-card whitespace-nowrap ${
            arriba ? '-translate-y-full' : ''
          }`}
          style={{
            // Que no se salga por los lados ni tape el punto
            left: Math.min(Math.max(sel.px, 70), ancho - 70),
            top: arriba ? sel.py - 12 : sel.py + 12,
          }}
        >
          <p className="text-gray-400">{fechaCorta(sel.s.date)}</p>
          <p className="font-bold text-gray-100 tabular-nums">{kg(sel.s.maxWeight)} kg</p>
          <p className="text-gray-500 tabular-nums">
            {sel.s.sets.map((st) => `${kg(st.weight)}×${st.reps}`).join(' · ')}
          </p>
        </div>
      )}
    </div>
  );
}
