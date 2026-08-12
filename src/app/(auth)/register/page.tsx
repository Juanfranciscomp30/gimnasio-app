'use client';
// 'use client' le dice a Next.js: "este componente necesita ejecutarse en el
// navegador, no solo en el servidor", porque usamos useState, onClick, etc.
// Sin esto, Next.js asumiría que es un componente de servidor y fallaría.

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function RegisterPage() {
  // useState crea una "variable reactiva": cuando cambia, React vuelve a
  // pintar el componente automáticamente. formData guarda lo que el usuario
  // escribe en el formulario.
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
  });

  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);

  const router = useRouter(); // nos permite redirigir a otra página tras registrarnos

  // Esta función se ejecuta cada vez que el usuario escribe en CUALQUIER
  // input (usamos el mismo "name" del input para saber cuál actualizar)
  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  }

  // Esta función se ejecuta al enviar el formulario
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault(); // evita que la página se recargue (comportamiento por defecto de un <form>)
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

      // Registro correcto -> lo mandamos a la página de login
      router.push('/login');
    } catch (err) {
      setError('Error de conexión, inténtalo de nuevo');
    } finally {
      setCargando(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50">
      <form
        onSubmit={handleSubmit}
        className="bg-white p-8 rounded-lg shadow-md w-full max-w-sm space-y-4"
      >
        <h1 className="text-xl font-bold text-center">Crear cuenta</h1>

        {error && (
          <p className="text-red-600 text-sm bg-red-50 p-2 rounded">{error}</p>
        )}

        <div>
          <label className="block text-sm font-medium mb-1">Nombre</label>
          <input
            type="text"
            name="name"
            value={formData.name}
            onChange={handleChange}
            required
            className="w-full border rounded px-3 py-2"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Email</label>
          <input
            type="email"
            name="email"
            value={formData.email}
            onChange={handleChange}
            required
            className="w-full border rounded px-3 py-2"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Contraseña</label>
          <input
            type="password"
            name="password"
            value={formData.password}
            onChange={handleChange}
            required
            minLength={6}
            className="w-full border rounded px-3 py-2"
          />
        </div>

        <button
          type="submit"
          disabled={cargando}
          className="w-full bg-gray-900 text-white py-2 rounded hover:bg-gray-800 disabled:opacity-50"
        >
          {cargando ? 'Creando cuenta...' : 'Registrarme'}
        </button>

        <p className="text-sm text-center text-gray-600">
          ¿Ya tienes cuenta?{' '}
          <a href="/login" className="underline">
            Inicia sesión
          </a>
        </p>
      </form>
    </main>
  );
}