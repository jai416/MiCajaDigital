'use client';

import { useEffect, useState } from 'react';
import { fechaHora } from '@/lib/formato';

interface Conflicto {
  id: number;
  tabla: string;
  row_id: string;
  user_id: string | null;
  campo: string | null;
  valor_local: string | null;
  valor_remoto: string | null;
  accion: string;
  resuelto: boolean;
  created_at: string;
}

export default function ConflictosPage() {
  const [conflictos, setConflictos] = useState<Conflicto[]>([]);
  const [soloPendientes, setSoloPendientes] = useState(true);
  const [pagina, setPagina] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPaginas, setTotalPaginas] = useState(1);
  const [cargado, setCargado] = useState(false);

  const cargar = async (p: number = 1) => {
    const res = await fetch(`/api/conflictos?pagina=${p}&porPagina=30&pendientes=${soloPendientes}`);
    const json = await res.json();
    if (res.ok) {
      setConflictos(json.data ?? []);
      setPagina(json.pagina ?? 1);
      setTotalPaginas(json.totalPaginas ?? 1);
      setTotal(json.total ?? 0);
    }
    setCargado(true);
  };

  useEffect(() => { cargar(1); }, [soloPendientes]);

  const resolver = async (id: number) => {
    await fetch('/api/conflictos', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, resuelto: true, accion: 'resuelto_manual' }),
    });
    await cargar(pagina);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Conflictos de sync</h1>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-gray-600">
            <input type="checkbox" checked={soloPendientes}
              onChange={(e) => setSoloPendientes(e.target.checked)}
              className="rounded" />
            Solo pendientes
          </label>
          <span className="text-sm text-gray-500">{total} conflictos</span>
        </div>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6">
        <p className="text-sm text-amber-800">
          <strong>¿Qué son los conflictos?</strong> Cuando dos dispositivos editan la misma fila offline y sincronizan,
          el último en subir sobrescribe al otro. Este registro muestra qué campos cambiaron
          para que puedas decidir si restaurar el valor anterior.
        </p>
      </div>

      <div className="space-y-3">
        {!cargado && <p className="text-gray-500">Cargando...</p>}
        {cargado && conflictos.length === 0 && (
          <p className="text-gray-500">No hay conflictos {soloPendientes ? 'pendientes' : ''}. 🎉</p>
        )}
        {conflictos.map((c) => (
          <div key={c.id} className={`bg-white rounded-xl shadow-sm border p-4 ${
            c.resuelto ? 'border-gray-200 opacity-60' : 'border-amber-300'
          }`}>
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <span className="px-2 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-700">
                    {c.tabla}
                  </span>
                  <span className="font-mono text-xs text-gray-500">fila {c.row_id}</span>
                  {c.campo && <span className="font-mono text-xs text-gray-500">campo: {c.campo}</span>}
                  {c.resuelto && (
                    <span className="px-2 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-700">
                      resuelto
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="bg-red-50 rounded-lg p-2">
                    <p className="font-semibold text-red-600 mb-1">Valor local (perdido)</p>
                    <p className="text-red-800 font-mono break-all">{c.valor_local ?? '—'}</p>
                  </div>
                  <div className="bg-green-50 rounded-lg p-2">
                    <p className="font-semibold text-green-600 mb-1">Valor remoto (guardado)</p>
                    <p className="text-green-800 font-mono break-all">{c.valor_remoto ?? '—'}</p>
                  </div>
                </div>
                <p className="text-xs text-gray-400 mt-2">{fechaHora(c.created_at)}</p>
              </div>
              {!c.resuelto && (
                <button onClick={() => resolver(c.id)}
                  className="px-3 py-1 text-xs font-semibold bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 shrink-0">
                  Marcar resuelto
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {totalPaginas > 1 && (
        <div className="flex items-center justify-between mt-6">
          <button onClick={() => cargar(pagina - 1)} disabled={pagina <= 1}
            className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-semibold disabled:opacity-40">
            ← Anterior
          </button>
          <span className="text-xs text-gray-500">Página {pagina} de {totalPaginas}</span>
          <button onClick={() => cargar(pagina + 1)} disabled={pagina >= totalPaginas}
            className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-semibold disabled:opacity-40">
            Siguiente →
          </button>
        </div>
      )}
    </div>
  );
}
