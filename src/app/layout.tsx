import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Gimnasio App',
  description: 'Gestión de clases y reservas del gimnasio',
  manifest: '/manifest.json',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
