'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faDumbbell,
  faUser,
  faEnvelope,
  faLock,
  faTriangleExclamation,
} from '@fortawesome/free-solid-svg-icons';
import { tapScale } from '@/lib/motion';

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
            Únete al gimnasio
          </p>
          <h1 className="text-2xl font-extrabold text-white">Crear cuenta</h1>
        </div>

        {error && (
          <motion.p
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-danger text-sm bg-dangersoft border border-danger/30 px-3 py-2 rounded-xl flex items-center gap-2"
          >
            <FontAwesomeIcon icon={faTriangleExclamation} className="w-3.5 h-3.5 shrink-0" />
            {error}
          </motion.p>
        )}

        <div>
          <label className="block text-xs font-semibold text-gray-400 mb-1.5">Nombre</label>
          <div className="relative">
            <FontAwesomeIcon icon={faUser} className="absolute left-4 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-600" />
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              required
              className="w-full bg-page border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-white placeholder:text-gray-600 focus:outline-none focus:border-accent/60 focus:ring-2 focus:ring-accent/20 transition"
              placeholder="Tu nombre"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-400 mb-1.5">Email</label>
          <div className="relative">
            <FontAwesomeIcon icon={faEnvelope} className="absolute left-4 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-600" />
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
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
              type="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              required
              minLength={6}
              className="w-full bg-page border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-white placeholder:text-gray-600 focus:outline-none focus:border-accent/60 focus:ring-2 focus:ring-accent/20 transition"
              placeholder="Mínimo 6 caracteres"
            />
          </div>
        </div>

        <motion.button
          type="submit"
          disabled={cargando}
          whileHover={{ y: -1 }}
          whileTap={tapScale}
          className="w-full bg-gradient-accent text-page font-bold py-2.5 rounded-xl shadow-glow disabled:opacity-50 transition"
        >
          {cargando ? 'Creando cuenta...' : 'Registrarme'}
        </motion.button>

        <p className="text-sm text-center text-gray-500">
          ¿Ya tienes cuenta?{' '}
          <a href="/login" className="text-accent font-semibold hover:underline">
            Inicia sesión
          </a>
        </p>
      </motion.form>
    </main>
  );
}
