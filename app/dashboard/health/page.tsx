'use client';

import { useEffect, useState } from 'react';
import { fechaHora } from '@/lib/formato';

interface CheckResult {
  ok: boolean;
  detalle?: string;
}

interface HealthResponse {
  status: string;
  timestamp: string;
  checks: Record<string, CheckResult>;
}

export default function HealthPage() {
  const [data, setData] = useState<HealthResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const check = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/health');
      const json = await res.json();
      setData(json);
    } catch {
      setError('No se pudo contactar al servidor');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    check();
  }, []);

  return (
    <div>
      <h1 className="text-2xl font-bold text-mc-text mb-2">Estado del sistema</h1>
      <p className="text-sm text-mc-muted mb-6">
        Verifica que el panel admin, Supabase y las variables de entorno funcionen correctamente.
      </p>

      {loading && <p className="text-mc-muted">Comprobando...</p>}

      {error && (
        <div className="bg-mc-danger/10 border border-mc-danger text-mc-danger rounded-lg p-4 mb-6">{error}</div>
      )}

      {data && (
        <div className="space-y-4 mb-6">
          <div
            className={`flex items-center justify-between bg-mc-surface rounded-xl shadow-sm border p-4 ${
              data.status === 'ok' ? 'border-mc-primary' : 'border-mc-danger'
            }`}
          >
            <span className="font-semibold text-mc-text">Estado general</span>
            <span
              className={`px-3 py-1 rounded-full text-sm font-semibold ${
                data.status === 'ok' ? 'bg-mc-soft text-mc-primary' : 'bg-mc-danger/10 text-mc-danger'
              }`}
            >
              {data.status === 'ok' ? 'Todo OK' : 'Problema detectado'}
            </span>
          </div>

          {Object.entries(data.checks).map(([nombre, check]) => (
            <div key={nombre} className="bg-mc-surface rounded-xl shadow-sm border border-mc-border p-4">
              <div className="flex items-center justify-between mb-1">
                <span className="font-medium text-mc-text capitalize">{nombre}</span>
                <span
                  className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                    check.ok ? 'bg-mc-soft text-mc-primary' : 'bg-mc-danger/10 text-mc-danger'
                  }`}
                >
                  {check.ok ? 'OK' : 'FALLO'}
                </span>
              </div>
              {check.detalle && <p className="text-sm text-mc-muted">{check.detalle}</p>}
            </div>
          ))}

          <p className="text-xs text-mc-muted">Última comprobación: {fechaHora(data.timestamp)}</p>
        </div>
      )}

      <button
        onClick={check}
        className="px-4 py-2 bg-mc-primary text-white rounded-lg hover:bg-mc-primary transition text-sm font-semibold"
      >
        Verificar de nuevo
      </button>
    </div>
  );
}
