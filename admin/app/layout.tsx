import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Mi Caja Digital - Admin',
  description: 'Panel de administración para Mi Caja Digital',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className="bg-gray-50 text-gray-900 min-h-screen">{children}</body>
    </html>
  );
}
