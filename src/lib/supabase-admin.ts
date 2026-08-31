import { createClient } from '@supabase/supabase-js';

// Cliente de Supabase con permisos totales (service role).
// SOLO se usa en rutas de API (servidor). NUNCA lo importes en un componente 'use client'.
export const supabaseAdmin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);