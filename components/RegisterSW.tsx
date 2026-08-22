'use client';

import { useEffect } from 'react';

export default function RegisterSW() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return;
    if ('serviceWorker' in navigator) {
      const version = process.env.NEXT_PUBLIC_APP_VERSION || '0';
      navigator.serviceWorker.register(`/sw.js?v=${version}`).catch(() => {
        // sin SW no pasa nada grave; el panel sigue funcionando online
      });
    }
  }, []);

  return null;
}
