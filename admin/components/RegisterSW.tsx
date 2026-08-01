'use client';

import { useEffect } from 'react';

export default function RegisterSW() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return;
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {
        // sin SW no pasa nada grave; el panel sigue funcionando online
      });
    }
  }, []);

  return null;
}
