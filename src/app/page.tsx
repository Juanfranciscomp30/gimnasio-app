import Link from 'next/link';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faDumbbell, faCalendarCheck, faBolt, faChartLine } from '@fortawesome/free-solid-svg-icons';

const VENTAJAS = [
  {
    icon: faCalendarCheck,
    titulo: 'Reserva en segundos',
    descripcion: 'Elige día y hora, y listo. Si la clase está completa, entras en lista de espera automática.',
  },
  {
    icon: faBolt,
    titulo: 'Avisos al instante',
    descripcion: 'Te enteras dentro de la app si una clase cambia de hora o se cancela.',
  },
  {
    icon: faChartLine,
    titulo: 'Todo bajo control',
    descripcion: 'Tu tarifa, tu uso semanal y el estado de tu cuota, siempre a la vista.',
  },
];

export default function HomePage() {
  return (
    <main className="relative min-h-screen bg-page bg-gradient-hero overflow-hidden">
      <div className="absolute -top-24 -left-24 w-72 h-72 bg-accent/10 rounded-full blur-3xl animate-float" />
      <div
        className="absolute top-1/3 -right-24 w-72 h-72 bg-accent/10 rounded-full blur-3xl animate-float"
        style={{ animationDelay: '1.2s' }}
      />

      <div className="relative max-w-4xl mx-auto px-5 pt-10 pb-16 sm:pt-16">
        <div className="flex items-center gap-2 mb-14 sm:mb-20">
          <span className="w-9 h-9 rounded-xl bg-gradient-accent flex items-center justify-center shadow-glow">
            <FontAwesomeIcon icon={faDumbbell} className="w-4 h-4 text-page" />
          </span>
          <span className="font-extrabold tracking-tight text-white text-lg">Gimnasio</span>
        </div>

        <div className="text-center max-w-xl mx-auto mb-14">
          <p className="text-accent text-xs font-semibold tracking-widest uppercase mb-3">
            Reserva tus clases
          </p>
          <h1 className="text-4xl sm:text-5xl font-extrabold text-white tracking-tight leading-[1.05] mb-5">
            Tu próximo entrenamiento, a un toque de distancia
          </h1>
          <p className="text-gray-400 text-sm sm:text-base mb-8">
            Gestiona tus reservas, tu tarifa y tus clases desde el móvil o el ordenador.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              href="/login"
              className="w-full sm:w-auto bg-gradient-accent text-page font-bold px-8 py-3 rounded-xl shadow-glow-lg hover:brightness-95 transition"
            >
              Iniciar sesión
            </Link>
            <Link
              href="/register"
              className="w-full sm:w-auto bg-white/5 hover:bg-white/10 text-gray-200 font-semibold px-8 py-3 rounded-xl transition-colors"
            >
              Crear cuenta
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {VENTAJAS.map((v) => (
            <div key={v.titulo} className="bg-card border border-white/5 rounded-2xl p-5">
              <div className="w-9 h-9 rounded-xl bg-accentsoft text-accent flex items-center justify-center mb-3">
                <FontAwesomeIcon icon={v.icon} className="w-4 h-4" />
              </div>
              <h2 className="font-semibold text-white text-sm mb-1">{v.titulo}</h2>
              <p className="text-xs text-gray-400 leading-relaxed">{v.descripcion}</p>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
