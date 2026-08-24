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
      <h1 className="text-2xl font-bold text-gray-800 mb-2">Estado del sistema</h1>
      <p className="text-sm text-gray-500 mb-6">
        Verifica que el panel admin, Supabase y las variables de entorno funcionen correctamente.
      </p>

      {loading && <p className="text-gray-500">Comprobando...</p>}

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-4 mb-6">{error}</div>
      )}

      {data && (
        <div className="space-y-4 mb-6">
          <div
            className={`flex items-center justify-between bg-white rounded-xl shadow-sm border p-4 ${
              data.status === 'ok' ? 'border-emerald-200' : 'border-red-200'
            }`}
          >
            <span className="font-semibold text-gray-700">Estado general</span>
            <span
              className={`px-3 py-1 rounded-full text-sm font-semibold ${
                data.status === 'ok' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
              }`}
            >
              {data.status === 'ok' ? 'Todo OK' : 'Problema detectado'}
            </span>
          </div>

          {Object.entries(data.checks).map(([nombre, check]) => (
            <div key={nombre} className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
              <div className="flex items-center justify-between mb-1">
                <span className="font-medium text-gray-700 capitalize">{nombre}</span>
                <span
                  className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                    check.ok ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                  }`}
                >
                  {check.ok ? 'OK' : 'FALLO'}
                </span>
              </div>
              {check.detalle && <p className="text-sm text-gray-500">{check.detalle}</p>}
            </div>
          ))}

          <p className="text-xs text-gray-500">Última comprobación: {fechaHora(data.timestamp)}</p>
        </div>
      )}

      <button
        onClick={check}
        className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition text-sm font-semibold"
      >
        Verificar de nuevo
      </button>
    </div>
  );
}
