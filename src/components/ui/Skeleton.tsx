// Placeholder de carga con efecto "shimmer" reutilizando el color de
// fondo `card` — para no dejar pantallas en blanco mientras llega la API.
export default function Skeleton({ className = '' }: { className?: string }) {
  return (
    <div
      className={`relative overflow-hidden bg-card rounded-2xl ${className}`}
    >
      <div className="absolute inset-0 bg-shimmer bg-[length:200%_100%] animate-shimmer" />
    </div>
  );
}
