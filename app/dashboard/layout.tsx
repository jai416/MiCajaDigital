'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [msgsNoLeidos, setMsgsNoLeidos] = useState(0);

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
        await Promise.all(llaves.map((k) => caches.delete(k)));
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
    { href: '/dashboard', label: 'Dashboard', icon: '📊' },
    { href: '/dashboard/negocios', label: 'Negocios', icon: '🏪' },
    { href: '/dashboard/codigos', label: 'Códigos de pago', icon: '🔑' },
    { href: '/dashboard/soporte', label: 'Soporte', icon: '💬' },
    { href: '/dashboard/soporte/mensajes', label: 'Mensajes', icon: '📩', badge: msgsNoLeidos },
    { href: '/dashboard/conflictos', label: 'Conflictos', icon: '⚠️' },
    { href: '/dashboard/logs', label: 'Logs de la app', icon: '🛠️' },
    { href: '/dashboard/health', label: 'Estado', icon: '🩺' },
  ];

  return (
    <div className="flex h-screen bg-gray-50">
      <a href="#contenido"
        className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded-lg focus:bg-emerald-600 focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-white">
        Saltar al contenido
      </a>

      <aside className={`fixed inset-y-0 left-0 z-30 w-64 bg-white shadow-lg transform ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0 lg:static transition-transform duration-200`}>
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-xl font-bold text-emerald-700">Mi Caja Digital</h2>
          <p className="text-xs text-gray-500">Panel Admin</p>
        </div>
        <nav className="p-4 space-y-1" aria-label="Secciones del panel">
          {navItems.map((item) => (
            <Link key={item.href} href={item.href}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition ${
                pathname === item.href ? 'bg-emerald-50 text-emerald-700' : 'text-gray-600 hover:bg-gray-100'
              }`}>
              <span>{item.icon}</span>
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
