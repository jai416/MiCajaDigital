'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LimpiarLogs() {
  const router = useRouter();
  const [cargando, setCargando] = useState(false);
  const [mensaje, setMensaje] = useState('');

  const limpiar = async () => {
    if (!confirm('¿Eliminar los logs de más de 30 días? Esta acción no se puede deshacer.')) return;
    setCargando(true);
    setMensaje('');
    try {
      const res = await fetch('/api/logs?dias=30', { method: 'DELETE' });
      const j = await res.json();
      if (res.ok) {
        setMensaje(`Se borraron ${j.borrados ?? 0} log(s) antiguos.`);
        router.refresh();
      } else {
        setMensaje(j.error || 'No se pudo limpiar.');
      }
    } catch {
      setMensaje('Error de red.');
    } finally {
      setCargando(false);
    }
  };

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        onClick={limpiar}
        disabled={cargando}
        className="px-4 py-2 rounded-lg text-xs font-semibold bg-gray-100 text-gray-700 hover:bg-gray-200 disabled:opacity-50 transition"
      >
        {cargando ? 'Limpiando...' : '🧹 Limpiar logs antiguos (>30 días)'}
      </button>
      {mensaje && <span className="text-xs text-gray-500">{mensaje}</span>}
    </div>
  );
}