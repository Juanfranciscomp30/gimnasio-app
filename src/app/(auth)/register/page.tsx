'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function RegisterPage() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
  });

  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);

  const router = useRouter();

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setCargando(true);

    try {
      const respuesta = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await respuesta.json();

      if (!respuesta.ok) {
        setError(data.error || 'Algo ha ido mal');
        return;
      }

      router.push('/login');
    } catch (err) {
      setError('Error de conexión, inténtalo de nuevo');
    } finally {
      setCargando(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-page px-5">
      <form
        onSubmit={handleSubmit}
        className="bg-card p-8 rounded-2xl w-full max-w-sm space-y-5"
      >
        <div>
          <p className="text-accent text-xs font-semibold tracking-widest uppercase mb-1">
            Únete al gimnasio
          </p>
          <h1 className="text-2xl font-extrabold text-white">Crear cuenta</h1>
        </div>

        {error && (
          <p className="text-danger text-sm bg-dangersoft border border-danger/30 px-3 py-2 rounded-xl">
            {error}
          </p>
        )}

        <div>
          <label className="block text-xs font-semibold text-gray-400 mb-1.5">Nombre</label>
          <input
            type="text"
            name="name"
            value={formData.name}
            onChange={handleChange}
            required
            className="w-full bg-page border border-white/10 rounded-xl px-4 py-2.5 text-white placeholder:text-gray-600 focus:outline-none focus:border-accent/60"
            placeholder="Tu nombre"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-400 mb-1.5">Email</label>
          <input
            type="email"
            name="email"
            value={formData.email}
            onChange={handleChange}
            required
            className="w-full bg-page border border-white/10 rounded-xl px-4 py-2.5 text-white placeholder:text-gray-600 focus:outline-none focus:border-accent/60"
            placeholder="tucorreo@ejemplo.com"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-400 mb-1.5">Contraseña</label>
          <input
            type="password"
            name="password"
            value={formData.password}
            onChange={handleChange}
            required
            minLength={6}
            className="w-full bg-page border border-white/10 rounded-xl px-4 py-2.5 text-white placeholder:text-gray-600 focus:outline-none focus:border-accent/60"
            placeholder="Mínimo 6 caracteres"
          />
        </div>

        <button
          type="submit"
          disabled={cargando}
          className="w-full bg-accent text-page font-bold py-2.5 rounded-xl hover:brightness-95 disabled:opacity-50 transition"
        >
          {cargando ? 'Creando cuenta...' : 'Registrarme'}
        </button>

        <p className="text-sm text-center text-gray-500">
          ¿Ya tienes cuenta?{' '}
          <a href="/login" className="text-accent font-semibold hover:underline">
            Inicia sesión
          </a>
        </p>
      </form>
    </main>
  );
}
