const withPWA = require('next-pwa')({
  dest: 'public',
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === 'development',
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    // Fotos de perfil servidas desde Supabase Storage (bucket público
    // "avatars"). Al pasar por next/image se sirven ya redimensionadas
    // y en un formato moderno (webp/avif) en vez del original.
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
    ],
    // Los avatares siempre se muestran pequeños (24-96px): no hace falta
    // que Next genere ni cachee tamaños intermedios grandes.
    imageSizes: [24, 32, 48, 64, 96, 128, 256],
  },
};

module.exports = withPWA(nextConfig);
