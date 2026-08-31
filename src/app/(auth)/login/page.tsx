'use client';

import { useState } from 'react';
import { signIn, getSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);

  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setCargando(true);

    const resultado = await signIn('credentials', {
      email,
      password,
      redirect: false,
    });

    setCargando(false);

    if (resultado?.error) {
      setError('Email o contraseña incorrectos');
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

  return (
    <main className="min-h-screen flex items-center justify-center bg-page px-5">
      <form
        onSubmit={handleSubmit}
        className="bg-card p-8 rounded-2xl w-full max-w-sm space-y-5"
      >
        <div>
          <p className="text-accent text-xs font-semibold tracking-widest uppercase mb-1">
            Bienvenido de nuevo
          </p>
          <h1 className="text-2xl font-extrabold text-white">Iniciar sesión</h1>
        </div>

        {error && (
          <p className="text-danger text-sm bg-dangersoft border border-danger/30 px-3 py-2 rounded-xl">
            {error}
          </p>
        )}

        <div>
          <label className="block text-xs font-semibold text-gray-400 mb-1.5">Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full bg-page border border-white/10 rounded-xl px-4 py-2.5 text-white placeholder:text-gray-600 focus:outline-none focus:border-accent/60"
            placeholder="tucorreo@ejemplo.com"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-400 mb-1.5">Contraseña</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="w-full bg-page border border-white/10 rounded-xl px-4 py-2.5 text-white placeholder:text-gray-600 focus:outline-none focus:border-accent/60"
            placeholder="••••••••"
          />
        </div>

        <button
          type="submit"
          disabled={cargando}
          className="w-full bg-accent text-page font-bold py-2.5 rounded-xl hover:brightness-95 disabled:opacity-50 transition"
        >
          {cargando ? 'Entrando...' : 'Entrar'}
        </button>

        <p className="text-sm text-center text-gray-500">
          ¿No tienes cuenta?{' '}
          <a href="/register" className="text-accent font-semibold hover:underline">
            Regístrate
          </a>
        </p>
      </form>
    </main>
  );
}
