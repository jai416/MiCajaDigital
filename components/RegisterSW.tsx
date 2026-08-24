'use client';

import { useEffect, useState } from 'react';

export default function RegisterSW() {
  const [nuevaVersion, setNuevaVersion] = useState(false);

  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return;
    if (!('serviceWorker' in navigator)) return;
    const version = process.env.NEXT_PUBLIC_APP_VERSION || '0';
    navigator.serviceWorker
      .register(`/sw.js?v=${version}`)
      .then((reg) => {
        // SW nuevo instalado con una sesión ya controlada → hay release nueva
        // esperando (sw.js hace skipWaiting; el reload es manual para no
        // interrumpir a mitad de una acción).
        if (reg.waiting && navigator.serviceWorker.controller) {
          setNuevaVersion(true);
          return;
        }
        reg.addEventListener('updatefound', () => {
          const nuevo = reg.installing;
          nuevo?.addEventListener('statechange', () => {
            if (nuevo.state === 'installed' && navigator.serviceWorker.controller) {
              setNuevaVersion(true);
            }
          });
        });
      })
      .catch(() => {
        // sin SW no pasa nada grave; el panel sigue funcionando online
      });
  }, []);

  if (!nuevaVersion) return null;
  return (
    <div
      role="status"
      className="fixed bottom-4 right-4 z-50 flex items-center gap-3 rounded-lg bg-emerald-600 px-4 py-3 text-sm text-white shadow-lg"
    >
      Hay una versión nueva del panel.
      <button
        onClick={() => window.location.reload()}
        className="rounded bg-white/15 px-2 py-1 font-semibold underline hover:bg-white/25"
      >
        Actualizar
      </button>
    </div>
  );
}
