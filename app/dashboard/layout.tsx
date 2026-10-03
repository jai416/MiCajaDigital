'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';

// Iconos del panel: SVG inline en vez de emojis. Los emojis se ven distintos en
// cada sistema operativo y no tienen color de marca.
const RUTAS: Record<string, string> = {
  dashboard: 'M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z',
  negocios: 'M3 21h18V7H3v14zm2-2v-8h5v8H5zm7 0v-8h7v8h-7z',
  actividad: 'M3 17h4v-7H3v7zm7 0h4V4h-4v13zm7 0h4v-4h-4v4z',
  codigos: 'M4 4h16v6H4V4zm0 10h6v6H4v-6zm8 0h8v6h-8v-6z',
  soporte: 'M12 2a9 9 0 0 0-9 9v6a2 2 0 0 0 2 2h2v-8H5v0a7 7 0 0 1 14 0v1h-2v8h3a2 2 0 0 0 2-2v-6a9 9 0 0 0-9-9z',
  mensajes: 'M4 4h16v12H7l-3 3V4zm3 4v2h10V8H7zm0 4v2h7v-2H7z',
  conflictos: 'M12 2 2 7v6c0 5 4.2 8.6 10 9 5.8-.4 10-4 10-9V7l-10-5zm0 5 6 3v3c0 3-2.5 5.6-6 6-3.5-.4-6-3-6-6v-3l6-3z',
  versiones: 'M4 4h16v4H4V4zm0 6h10v4H4v-4zm0 6h16v4H4v-4z',
  logs: 'M6 2h9l5 5v15H6V2zm8 1.5V8h4.5L14 3.5zM8 12h8v2H8v-2zm0 4h8v2H8v-2z',
  estado: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm-1 5h2v6h-2V7zm0 8h2v2h-2v-2z',
};

function Icono({ nombre }: { nombre: string }) {
  const d = RUTAS[nombre];
  if (!d) return <span className="w-5" />;
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"
      style={{ fill: 'var(--mc-text-2)' }}>
      <path d={d} />
    </svg>
  );
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [msgsNoLeidos, setMsgsNoLeidos] = useState(0);
  // Tema oscuro con los mismos tokens que la app (globals.css). Se guarda la
  // preferencia; si no hay, se sigue al sistema.
  const [dark, setDark] = useState(false);

  useEffect(() => {
    const guardado = window.localStorage.getItem('panel_tema');
    const inicial = guardado
      ? guardado === 'oscuro'
      : window.matchMedia('(prefers-color-scheme: dark)').matches;
    setDark(inicial);
    document.documentElement.classList.toggle('dark', inicial);
  }, []);

  const toggleTema = () => {
    const nuevo = !dark;
    setDark(nuevo);
    document.documentElement.classList.toggle('dark', nuevo);
    window.localStorage.setItem('panel_tema', nuevo ? 'oscuro' : 'claro');
  };

  useEffect(() => {
    const fetchConteo = () => {
      fetch('/api/mensajes?conteo=true')
        .then((r) => r.json())
        .then((j) => { if (j.conteo != null) setMsgsNoLeidos(j.conteo); })
        .catch(() => {});
    };
    fetchConteo();
    const iv = setInterval(fetchConteo, 60000);
    return () => clearInterval(iv);
  }, []);

  const handleLogout = async () => {
    try {
      if ('caches' in window) {
        const llaves = await caches.keys();
        const appCaches = llaves.filter((k) => k.includes('micajadigital') || k.includes('admin'));
        await Promise.all(appCaches.map((k) => caches.delete(k)));
      }
      if ('serviceWorker' in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map((r) => r.unregister()));
      }
    } catch {}
    await fetch('/api/logout', { method: 'POST' });
    router.replace('/login');
    router.refresh();
  };

  const navItems = [
    { href: '/dashboard', label: 'Dashboard', icon: 'dashboard' },
    { href: '/dashboard/negocios', label: 'Negocios', icon: 'negocios' },
    { href: '/dashboard/actividad', label: 'Actividad', icon: 'actividad' },
    { href: '/dashboard/codigos', label: 'Códigos de pago', icon: 'codigos' },
    { href: '/dashboard/soporte', label: 'Soporte', icon: 'soporte' },
    { href: '/dashboard/soporte/mensajes', label: 'Mensajes', icon: 'mensajes', badge: msgsNoLeidos },
    { href: '/dashboard/conflictos', label: 'Conflictos', icon: 'conflictos' },
    { href: '/dashboard/versiones', label: 'Versiones', icon: 'versiones' },
    { href: '/dashboard/logs', label: 'Logs de la app', icon: 'logs' },
    { href: '/dashboard/health', label: 'Estado', icon: 'estado' },
  ];

  return (
    <div className="flex h-screen" style={{ background: 'var(--mc-bg)', color: 'var(--mc-text)' }}>
      <a href="#contenido"
        className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded-lg focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-white"
        style={{ background: 'var(--mc-primary)' }}>
        Saltar al contenido
      </a>

      <aside
        className={`fixed inset-y-0 left-0 z-30 w-64 shadow-lg transform ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0 lg:static transition-transform duration-200`}
        style={{ background: 'var(--mc-surface)', borderRight: '1px solid var(--mc-border)' }}>
        <div className="flex items-center gap-3 p-5" style={{ borderBottom: '1px solid var(--mc-border)' }}>
          {/* Logo real de la app (mismo arte que el launcher del teléfono) */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/logo.png" alt="" width={36} height={36}
            className="rounded-lg" style={{ background: 'var(--mc-primary)', objectFit: 'contain', padding: 3 }} />
          <div className="min-w-0">
            <h2 className="text-base font-bold leading-tight" style={{ color: 'var(--mc-text)' }}>Mi Caja Digital</h2>
            <p className="text-xs" style={{ color: 'var(--mc-text-2)' }}>Panel de administracion</p>
          </div>
          <button onClick={toggleTema} title="Cambiar entre claro y oscuro"
            aria-label="Cambiar entre tema claro y oscuro"
            className="ml-auto rounded-lg p-2"
            style={{ color: 'var(--mc-text-2)', background: 'var(--mc-field)' }}>
            {dark ? (
              <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true" style={{ fill: 'currentColor' }}>
                <path d="M12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10zm0-5v3m0 14v3M2 12h3m14 0h3M4.2 4.2l2.1 2.1m11.4 11.4 2.1 2.1M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"
                  stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" />
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true" style={{ fill: 'currentColor' }}>
                <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
              </svg>
            )}
          </button>
        </div>
        <nav className="p-4 space-y-1" aria-label="Secciones del panel">
          {navItems.map((item) => (
            <Link key={item.href} href={item.href}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition ${
                pathname === item.href ? '' : ''
              }`}
              style={{
                background: pathname === item.href ? 'var(--mc-primary-light)' : 'transparent',
                color: pathname === item.href ? 'var(--mc-primary)' : 'var(--mc-text-2)',
              }}>
              <Icono nombre={item.icon} />
              <span className="flex-1">{item.label}</span>
              {'badge' in item && item.badge != null && item.badge > 0 && (
                <span className="px-2 py-0.5 bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[18px] text-center">
                  {item.badge > 99 ? '99+' : item.badge}
                </span>
              )}
            </Link>
          ))}
        </nav>
        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-gray-200">
          <button onClick={handleLogout}
            className="w-full px-4 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg transition">
            Cerrar Sesión
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="bg-white shadow-sm border-b border-gray-200 px-6 py-4 lg:hidden">
          <button onClick={() => setSidebarOpen(!sidebarOpen)}
            aria-label={sidebarOpen ? 'Cerrar menú' : 'Abrir menú'}
            aria-expanded={sidebarOpen}
            className="text-gray-600">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        </header>
        <main id="contenido" className="flex-1 overflow-auto p-6">{children}</main>
      </div>

      {sidebarOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-20 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}
    </div>
  );
}
