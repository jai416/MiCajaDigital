import type { Metadata, Viewport } from 'next';
import './globals.css';
import RegisterSW from '@/components/RegisterSW';

export const metadata: Metadata = {
  title: 'Mi Caja Digital - Admin',
  description: 'Panel de administración para Mi Caja Digital',
  manifest: '/manifest.webmanifest',
  icons: {
    icon: '/icons/icon-192.png',
    apple: '/icons/icon-192.png',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Admin MCD',
  },
  other: {
    'mobile-web-app-capable': 'yes',
  },
};

export const viewport: Viewport = {
  themeColor: '#059669',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className="min-h-screen" suppressHydrationWarning>
        {/* Aplica el tema antes de pintar: sin esto la pagina aparece clara un
            instante y luego salta a oscura (parpadeo). */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var g=window.localStorage.getItem('panel_tema');var d=g?g==='oscuro':window.matchMedia('(prefers-color-scheme: dark)').matches;document.documentElement.classList.toggle('dark',d);}catch(e){}})();`,
          }}
        />
        <RegisterSW />
        {children}
      </body>
    </html>
  );
}
