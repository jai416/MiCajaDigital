'use client';

import { useState } from 'react';

export default function BackupButton({
  negocioId,
  negocioNombre,
}: {
  negocioId?: string;
  negocioNombre?: string;
}) {
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');

  async function handleBackup() {
    setCargando(true);
    setError('');

    try {
      const body: Record<string, string> = {};
      if (negocioId) body.negocio_id = negocioId;

      const res = await fetch('/api/backup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: Object.keys(body).length > 0 ? JSON.stringify(body) : undefined,
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? `Error ${res.status}`);
      }

      // Recibir el JSON como blob y descargarlo
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;

      // Obtener el nombre del archivo del header Content-Disposition
      const disposition = res.headers.get('Content-Disposition') ?? '';
      const match = disposition.match(/filename="?(.+?)"?$/);
      a.download = match?.[1] ?? `micajadigital_backup_${new Date().toISOString().slice(0, 10)}.json`;

      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error desconocido');
    } finally {
      setCargando(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={handleBackup}
        disabled={cargando}
        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-lg text-sm font-semibold transition flex items-center gap-2"
      >
        {cargando ? (
          <>
            <span className="inline-block animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
            Exportando…
          </>
        ) : (
          <>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            {negocioNombre
              ? `Exportar respaldo de ${negocioNombre}`
              : 'Exportar respaldo completo'}
          </>
        )}
      </button>
      {error && (
        <span className="text-red-600 text-sm">{error}</span>
      )}
    </div>
  );
}
