'use client';

import { useEffect, useRef, useState } from 'react';

// Cuenta desde 0 hasta `value` con un pequeño "ease-out". Se usa en los
// números grandes (ingresos, contadores del dashboard) para dar sensación
// de vida sin meter una librería aparte solo para esto.
export default function AnimatedNumber({
  value,
  duration = 700,
  suffix = '',
  decimals = 0,
}: {
  value: number;
  duration?: number;
  suffix?: string;
  decimals?: number;
}) {
  const [mostrado, setMostrado] = useState(0);
  const inicioRef = useRef<number | null>(null);

  useEffect(() => {
    inicioRef.current = null;
    let frame: number;

    function tick(timestamp: number) {
      if (inicioRef.current === null) inicioRef.current = timestamp;
      const progreso = Math.min((timestamp - inicioRef.current) / duration, 1);
      const easeOut = 1 - Math.pow(1 - progreso, 3);
      setMostrado(value * easeOut);
      if (progreso < 1) frame = requestAnimationFrame(tick);
    }

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value, duration]);

  return (
    <>
      {mostrado.toLocaleString('es-ES', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      })}
      {suffix}
    </>
  );
}
