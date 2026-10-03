'use client';

import { useEffect, useState } from 'react';
import { fechaHora } from '@/lib/formato';

interface ActividadNegocio {
  negocio_id: string;
  email: string;
  nombre: string;
  ultimaSync: string;
  totalSyncs: number;
  exitosos: number;
  fallidos: number;
  warnings: number;
  ultimosLogs: Array<{ nivel: string; origen: string; mensaje: string; created_at: string }>;
}

export default function ActividadPage() {
  const [actividad, setActividad] = useState<ActividadNegocio[]>([]);
  const [cargado, setCargado] = useState(false);
  const [busqueda, setBusqueda] = useState('');
  const [busquedaInput, setBusquedaInput] = useState('');
  const [pagina, setPagina] = useState(1);
  const [totalPaginas, setTotalPaginas] = useState(1);
  const [total, setTotal] = useState(0);
  const [expandir, setExpandir] = useState<string | null>(null);

  const cargar = async (p: number = 1) => {
    try {
      const params = new URLSearchParams({ pagina: String(p), porPagina: '20' });
      if (busqueda) params.set('q', busqueda);
      const res = await fetch(`/api/actividad?${params}`);
      const json = await res.json();
      if (res.ok) {
        setActividad(json.data ?? []);
        setPagina(json.pagina ?? 1);
        setTotalPaginas(json.totalPaginas ?? 1);
        setTotal(json.total ?? 0);
      }
    } catch (e) { console.error(e); }
    setCargado(true);
  };

  useEffect(() => { cargar(); }, []);
  useEffect(() => { cargar(1); }, [busqueda]);

  const buscar = () => {
    setBusqueda(busquedaInput);
    setPagina(1);
  };

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <h1 className="text-2xl font-bold text-mc-text">Actividad de usuarios</h1>
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={busquedaInput}
            onChange={(e) => setBusquedaInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && buscar()}
            placeholder="Buscar por email o nombre..."
            className="px-3 py-2 border border-mc-border rounded-lg text-sm w-64"
          />
          <button onClick={buscar}
            className="px-4 py-2 bg-mc-primary text-white rounded-lg text-sm font-semibold hover:bg-mc-primary">
             Buscar
          </button>
        </div>
      </div>

      {!cargado && <p className="text-mc-muted">Cargando...</p>}
      {cargado && actividad.length === 0 && (
        <p className="text-mc-muted">No hay actividad registrada{busqueda ? ` para "${busqueda}"` : ''}.</p>
      )}

      <div className="space-y-4">
        {actividad.map((a) => (
          <div key={a.negocio_id}
            className="bg-mc-surface rounded-xl shadow-sm border border-mc-border p-5">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 mb-2">
                  <span className="text-lg"></span>
                  <div>
                    <p className="font-bold text-mc-text truncate">
                      {a.nombre || '(sin nombre)'}
                    </p>
                    <p className="text-sm text-mc-muted truncate">{a.email}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mt-3">
                  <div className="bg-mc-info/10 rounded-lg p-3">
                    <p className="text-lg font-bold text-mc-info">{a.totalSyncs}</p>
                    <p className="text-[11px] text-mc-info">Total syncs</p>
                  </div>
                  <div className="bg-mc-primary/10 rounded-lg p-3">
                    <p className="text-lg font-bold text-mc-primary">{a.exitosos}</p>
                    <p className="text-[11px] text-mc-primary">Exitosos</p>
                  </div>
                  <div className="bg-mc-danger/10 rounded-lg p-3">
                    <p className="text-lg font-bold text-mc-danger">{a.fallidos}</p>
                    <p className="text-[11px] text-mc-danger">Fallidos</p>
                  </div>
                  <div className="bg-violet-50 rounded-lg p-3">
                    <p className="text-lg font-bold text-violet-700">{a.warnings}</p>
                    <p className="text-[11px] text-violet-600">Advertencias</p>
                  </div>
                </div>

                <p className="text-xs text-mc-muted mt-2">
                  Última sync: {fechaHora(a.ultimaSync)}
                  {a.fallidos > 0 && (
                    <span className="ml-2 text-mc-danger font-semibold">
                       {a.fallidos} fallo{a.fallidos > 1 ? 's' : ''}
                    </span>
                  )}
                </p>
              </div>

              {a.ultimosLogs.length > 0 && (
                <button onClick={() => setExpandir(expandir === a.negocio_id ? null : a.negocio_id)}
                  className="px-3 py-1 text-xs font-semibold bg-mc-field text-mc-muted rounded-lg hover:bg-mc-border shrink-0">
                  {expandir === a.negocio_id ? '▲ Ocultar' : `▼ Logs (${a.ultimosLogs.length})`}
                </button>
              )}
            </div>

            {expandir === a.negocio_id && a.ultimosLogs.length > 0 && (
              <div className="mt-4 pt-4 border-t border-mc-border">
                <p className="text-xs font-bold text-mc-muted mb-2">Últimos logs de error:</p>
                <div className="space-y-1 max-h-40 overflow-auto">
                  {a.ultimosLogs.map((log, i) => (
                    <div key={i} className="flex items-start gap-2 text-xs">
                      <span className={`px-1.5 py-0.5 rounded font-bold shrink-0 ${
                        log.nivel === 'error' ? 'bg-mc-danger/10 text-mc-danger' : 'bg-yellow-100 text-yellow-700'
                      }`}>
                        {log.nivel}
                      </span>
                      <span className="text-mc-muted shrink-0">{log.origen}</span>
                      <span className="text-mc-text truncate">{log.mensaje}</span>
                      <span className="text-mc-muted shrink-0 ml-auto">{fechaHora(log.created_at)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {totalPaginas > 1 && (
        <div className="flex items-center justify-between mt-6">
          <button onClick={() => cargar(pagina - 1)} disabled={pagina <= 1}
            className="px-4 py-2 border border-mc-border rounded-lg text-sm font-semibold disabled:opacity-40">
             Anterior
          </button>
          <span className="text-xs text-mc-muted">Página {pagina} de {totalPaginas} ({total} usuarios)</span>
          <button onClick={() => cargar(pagina + 1)} disabled={pagina >= totalPaginas}
            className="px-4 py-2 border border-mc-border rounded-lg text-sm font-semibold disabled:opacity-40">
            Siguiente 
          </button>
        </div>
      )}
    </div>
  );
}
