import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { supabaseAdmin } from '@/lib/supabase-admin';

const BUCKET = 'avatars';
const TAMANO_MAXIMO = 5 * 1024 * 1024; // 5MB
const TIPOS_PERMITIDOS = ['image/jpeg', 'image/png', 'image/webp'];

// Sube (o reemplaza) la foto de perfil del usuario logueado a Supabase
// Storage y guarda la URL pública en profileImageUrl.
//
// Requiere que existan las variables SUPABASE_URL y
// SUPABASE_SERVICE_ROLE_KEY en .env, y un bucket público llamado
// "avatars" creado en el proyecto de Supabase.
export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const userId = (session.user as any).id;

  const formData = await request.formData();
  const file = formData.get('file');

  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'No se ha recibido ninguna imagen' }, { status: 400 });
  }

  if (!TIPOS_PERMITIDOS.includes(file.type)) {
    return NextResponse.json(
      { error: 'Formato no soportado. Usa JPG, PNG o WEBP.' },
      { status: 400 }
    );
  }

  if (file.size > TAMANO_MAXIMO) {
    return NextResponse.json({ error: 'La imagen no puede pesar más de 5MB' }, { status: 400 });
  }

  const extension = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg';
  const ruta = `${userId}/avatar.${extension}`;

  const bytes = new Uint8Array(await file.arrayBuffer());

  const { error: errorSubida } = await supabaseAdmin.storage
    .from(BUCKET)
    .upload(ruta, bytes, { contentType: file.type, upsert: true });

  if (errorSubida) {
    console.error('Error subiendo avatar a Supabase:', errorSubida);
    return NextResponse.json(
      { error: 'No se pudo subir la imagen. Revisa la configuración de Supabase.' },
      { status: 500 }
    );
  }

  const { data: publicData } = supabaseAdmin.storage.from(BUCKET).getPublicUrl(ruta);
  // Rompemos la caché del navegador/CDN añadiendo un timestamp, ya que la
  // ruta del archivo es siempre la misma (se sobrescribe con upsert)
  const urlConCacheBust = `${publicData.publicUrl}?v=${Date.now()}`;

  const usuarioActualizado = await prisma.user.update({
    where: { id: userId },
    data: { profileImageUrl: urlConCacheBust },
    select: { profileImageUrl: true },
  });

  return NextResponse.json(usuarioActualizado);
}

// Quita la foto de perfil (vuelve al avatar con la inicial del nombre)
export async function DELETE() {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const usuarioActualizado = await prisma.user.update({
    where: { id: (session.user as any).id },
    data: { profileImageUrl: null },
    select: { profileImageUrl: true },
  });

  return NextResponse.json(usuarioActualizado);
}
