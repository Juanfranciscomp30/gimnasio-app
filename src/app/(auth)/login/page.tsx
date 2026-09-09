'use client';

import { useEffect, useState } from 'react';
import { signIn, getSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faDumbbell,
  faEnvelope,
  faLock,
  faTriangleExclamation,
  faCircleCheck,
  faEye,
  faEyeSlash,
} from '@fortawesome/free-solid-svg-icons';
import { tapScale } from '@/lib/motion';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [avisoConfirmacion, setAvisoConfirmacion] = useState('');
  const [cargando, setCargando] = useState(false);
  const [mostrarPassword, setMostrarPassword] = useState(false);

  // Estado del botón "reenviar correo de confirmación", que solo aparece
  // cuando el login falla concretamente por email sin confirmar.
  const [mostrarReenviar, setMostrarReenviar] = useState(false);
  const [reenviando, setReenviando] = useState(false);
  const [reenviado, setReenviado] = useState(false);

  const router = useRouter();

  // Al volver del enlace del email (GET /api/auth/verify), esa ruta nos
  // redirige aquí con ?verificado=ok o ?verificado=error. Lo leemos con
  // window.location en vez de useSearchParams para no forzar un boundary
  // de Suspense en una página que, por lo demás, es puramente de cliente.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const verificado = params.get('verificado');
    if (verificado === 'ok') {
      setAvisoConfirmacion('¡Cuenta confirmada! Ya puedes iniciar sesión.');
    } else if (verificado === 'error') {
      setAvisoConfirmacion(
        'El enlace de confirmación no es válido o ha caducado. Inicia sesión y te ofreceremos reenviarlo.'
      );
    }
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setMostrarReenviar(false);
    setReenviado(false);
    setCargando(true);

    const resultado = await signIn('credentials', {
      email,
      password,
      redirect: false,
    });

    setCargando(false);

    if (resultado?.error) {
      if (resultado.error === 'EMAIL_NO_VERIFICADO') {
        setError('Todavía no has confirmado tu cuenta. Revisa tu correo.');
        setMostrarReenviar(true);
      } else {
        setError('Email o contraseña incorrectos');
      }
      return;
    }

    const session = await getSession();

    if ((session?.user as any)?.role === 'ADMIN') {
      router.push('/admin');
    } else {
      router.push('/inicio');
    }
    router.refresh();
  }

  async function handleReenviar() {
    setReenviando(true);
    try {
      await fetch('/api/auth/resend-verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      setReenviado(true);
      setMostrarReenviar(false);
    } finally {
      setReenviando(false);
    }
  }

  return (
    <main className="relative min-h-screen flex items-center justify-center bg-page bg-gradient-hero px-5 overflow-hidden">
      <div className="absolute -top-24 -left-24 w-72 h-72 bg-accent/10 rounded-full blur-3xl animate-float" />
      <div className="absolute -bottom-24 -right-24 w-72 h-72 bg-accent/10 rounded-full blur-3xl animate-float" style={{ animationDelay: '1.5s' }} />

      <motion.form
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 260, damping: 26 }}
        onSubmit={handleSubmit}
        className="relative bg-card border border-white/5 shadow-card p-8 rounded-3xl w-full max-w-sm space-y-5"
      >
        <div className="flex flex-col items-center text-center mb-1">
          <div className="w-12 h-12 rounded-2xl bg-gradient-accent flex items-center justify-center mb-4 shadow-glow">
            <FontAwesomeIcon icon={faDumbbell} className="w-5 h-5 text-page" />
          </div>
          <p className="text-accent text-xs font-semibold tracking-widest uppercase mb-1">
            Bienvenido de nuevo
          </p>
          <h1 className="text-2xl font-extrabold text-white">Iniciar sesión</h1>
        </div>

        {avisoConfirmacion && (
          <motion.p
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-accent text-sm bg-accent/10 border border-accent/30 px-3 py-2 rounded-xl flex items-center gap-2"
          >
            <FontAwesomeIcon icon={faCircleCheck} className="w-3.5 h-3.5 shrink-0" />
            {avisoConfirmacion}
          </motion.p>
        )}

        {error && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-danger text-sm bg-dangersoft border border-danger/30 px-3 py-2 rounded-xl space-y-2"
          >
            <p className="flex items-center gap-2">
              <FontAwesomeIcon icon={faTriangleExclamation} className="w-3.5 h-3.5 shrink-0" />
              {error}
            </p>
            {mostrarReenviar && (
              <button
                type="button"
                onClick={handleReenviar}
                disabled={reenviando}
                className="text-xs font-semibold text-danger underline underline-offset-2 disabled:opacity-50"
              >
                {reenviando ? 'Enviando...' : 'Reenviar correo de confirmación'}
              </button>
            )}
            {reenviado && (
              <p className="text-xs text-gray-300">
                Si la cuenta está pendiente, te hemos enviado un nuevo enlace. Revisa tu correo.
              </p>
            )}
          </motion.div>
        )}

        <div>
          <label className="block text-xs font-semibold text-gray-400 mb-1.5">Email</label>
          <div className="relative">
            <FontAwesomeIcon icon={faEnvelope} className="absolute left-4 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-600" />
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full bg-page border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-white placeholder:text-gray-600 focus:outline-none focus:border-accent/60 focus:ring-2 focus:ring-accent/20 transition"
              placeholder="tucorreo@ejemplo.com"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-400 mb-1.5">Contraseña</label>
          <div className="relative">
            <FontAwesomeIcon icon={faLock} className="absolute left-4 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-600" />
            <input
              type={mostrarPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full bg-page border border-white/10 rounded-xl pl-10 pr-10 py-2.5 text-white placeholder:text-gray-600 focus:outline-none focus:border-accent/60 focus:ring-2 focus:ring-accent/20 transition"
              placeholder="••••••••"
            />
            <button
              type="button"
              onClick={() => setMostrarPassword((v) => !v)}
              tabIndex={-1}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-600 hover:text-gray-400 transition"
              aria-label={mostrarPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
            >
              <FontAwesomeIcon icon={mostrarPassword ? faEyeSlash : faEye} className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        <motion.button
          type="submit"
          disabled={cargando}
          whileHover={{ y: -1 }}
          whileTap={tapScale}
          className="w-full bg-gradient-accent text-page font-bold py-2.5 rounded-xl shadow-glow disabled:opacity-50 transition"
        >
          {cargando ? 'Entrando...' : 'Entrar'}
        </motion.button>

        <p className="text-sm text-center text-gray-500">
          ¿No tienes cuenta?{' '}
          <a href="/register" className="text-accent font-semibold hover:underline">
            Regístrate
          </a>
        </p>
      </motion.form>
    </main>
  );
}
