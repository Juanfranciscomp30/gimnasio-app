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

    // signIn('credentials', ...) llama por debajo a la función authorize()
    // que definimos en lib/auth.ts. redirect: false evita que NextAuth
    // redirija automáticamente, así podemos controlar el error nosotros mismos.
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

   // Login correcto. Consultamos la sesión recién creada para saber el rol
    // y mandar a cada usuario a SU interfaz correspondiente.
    const session = await getSession();

    if ((session?.user as any)?.role === 'ADMIN') {
      router.push('/admin');
    } else {
      router.push('/mis-clases');
    }
    router.refresh(); // fuerza a que la app relea la sesión ya iniciada
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50">
      <form
        onSubmit={handleSubmit}
        className="bg-white p-8 rounded-lg shadow-md w-full max-w-sm space-y-4"
      >
        <h1 className="text-xl font-bold text-center">Iniciar sesión</h1>

        {error && (
          <p className="text-red-600 text-sm bg-red-50 p-2 rounded">{error}</p>
        )}

        <div>
          <label className="block text-sm font-medium mb-1">Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full border rounded px-3 py-2"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Contraseña</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="w-full border rounded px-3 py-2"
          />
        </div>

        <button
          type="submit"
          disabled={cargando}
          className="w-full bg-gray-900 text-white py-2 rounded hover:bg-gray-800 disabled:opacity-50"
        >
          {cargando ? 'Entrando...' : 'Entrar'}
        </button>

        <p className="text-sm text-center text-gray-600">
          ¿No tienes cuenta?{' '}
          <a href="/register" className="underline">
            Regístrate
          </a>
        </p>
      </form>
    </main>
  );
}