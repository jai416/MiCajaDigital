'use client';

import { useEffect, useState } from 'react';
import { fechaHora } from '@/lib/formato';

interface Ticket {
  id: number;
  user_id: string;
  negocio_id: string | null;
  categoria: string;
  mensaje: string;
  estado: string;
  respuesta_admin: string | null;
  created_at: string;
  updated_at: string;
}

const ESTADOS = ['todos', 'abierto', 'en_progreso', 'resuelto', 'cerrado'] as const;
const CAT_LABELS: Record<string, string> = {
  pago: '💰 Pago', sync: '🔄 Sync', bug: '🐞 Bug', sugerencia: '💡 Sugerencia', otro: '📝 Otro',
};
const CAT_COLORS: Record<string, string> = {
  pago: 'bg-amber-100 text-amber-700', sync: 'bg-blue-100 text-blue-700',
  bug: 'bg-red-100 text-red-700', sugerencia: 'bg-green-100 text-green-700',
  otro: 'bg-gray-100 text-gray-700',
};
const ESTADO_COLORS: Record<string, string> = {
  abierto: 'bg-red-100 text-red-700', en_progreso: 'bg-amber-100 text-amber-700',
  resuelto: 'bg-green-100 text-green-700', cerrado: 'bg-gray-100 text-gray-500',
};

export default function SoportePage() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [filtro, setFiltro] = useState('abierto');
  const [pagina, setPagina] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPaginas, setTotalPaginas] = useState(1);
  const [cargado, setCargado] = useState(false);
  const [editando, setEditando] = useState<number | null>(null);
  const [respuesta, setRespuesta] = useState('');

  const cargar = async (p: number = 1) => {
    const res = await fetch(`/api/soporte?pagina=${p}&porPagina=20&estado=${filtro}`);
    const json = await res.json();
    if (res.ok) {
      setTickets(json.data ?? []);
      setPagina(json.pagina ?? 1);
      setTotalPaginas(json.totalPaginas ?? 1);
      setTotal(json.total ?? 0);
    }
    setCargado(true);
  };

  useEffect(() => { cargar(1); }, [filtro]);

  const actualizar = async (id: number, estado: string, resp?: string) => {
    await fetch('/api/soporte', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, estado, respuesta_admin: resp }),
    });
    setEditando(null);
    setRespuesta('');
    await cargar(pagina);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Soporte</h1>
        <span className="text-sm text-gray-500">{total} tickets</span>
      </div>

      <div className="flex gap-2 mb-6">
        {ESTADOS.map((e) => (
          <button key={e} onClick={() => setFiltro(e)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold transition ${
              filtro === e ? 'bg-emerald-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}>
            {e === 'todos' ? 'Todos' : e.replace('_', ' ')}
          </button>
        ))}
      </div>

      <div className="space-y-4">
        {!cargado && <p className="text-gray-500">Cargando...</p>}
        {cargado && tickets.length === 0 && (
          <p className="text-gray-500">No hay tickets en este filtro.</p>
        )}
        {tickets.map((t) => (
          <div key={t.id} className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <span className={`px-2 py-1 rounded-full text-xs font-semibold ${CAT_COLORS[t.categoria] ?? CAT_COLORS.otro}`}>
                    {CAT_LABELS[t.categoria] ?? t.categoria}
                  </span>
                  <span className={`px-2 py-1 rounded-full text-xs font-semibold ${ESTADO_COLORS[t.estado]}`}>
                    {t.estado.replace('_', ' ')}
                  </span>
                  <span className="text-xs text-gray-400">#{t.id}</span>
                </div>
                <p className="text-sm text-gray-700 whitespace-pre-wrap">{t.mensaje}</p>
                {t.respuesta_admin && (
                  <div className="mt-3 bg-emerald-50 border border-emerald-200 rounded-lg p-3">
                    <p className="text-xs font-semibold text-emerald-700 mb-1">Tu respuesta:</p>
                    <p className="text-sm text-emerald-800 whitespace-pre-wrap">{t.respuesta_admin}</p>
                  </div>
                )}
                <p className="text-xs text-gray-400 mt-2">{fechaHora(t.created_at)}</p>
              </div>
              <div className="flex flex-col gap-1 shrink-0">
                {t.estado !== 'cerrado' && (
                  <>
                    {t.estado === 'abierto' && (
                      <button onClick={() => actualizar(t.id, 'en_progreso')}
                        className="px-3 py-1 text-xs font-semibold bg-amber-500 text-white rounded-lg hover:bg-amber-600">
                        Tomar
                      </button>
                    )}
                    {editando === t.id ? (
                      <div className="space-y-1">
                        <textarea value={respuesta} onChange={(e) => setRespuesta(e.target.value)}
                          placeholder="Respuesta..." rows={3}
                          className="w-48 px-2 py-1 border border-gray-300 rounded text-xs" />
                        <div className="flex gap-1">
                          <button onClick={() => actualizar(t.id, 'resuelto', respuesta)}
                            className="px-2 py-1 text-xs bg-green-600 text-white rounded">Enviar</button>
                          <button onClick={() => setEditando(null)}
                            className="px-2 py-1 text-xs bg-gray-200 rounded">Cancelar</button>
                        </div>
                      </div>
                    ) : (
                      <button onClick={() => { setEditando(t.id); setRespuesta(t.respuesta_admin ?? ''); }}
                        className="px-3 py-1 text-xs font-semibold bg-emerald-500 text-white rounded-lg hover:bg-emerald-600">
                        Responder
                      </button>
                    )}
                    <button onClick={() => actualizar(t.id, 'cerrado')}
                      className="px-3 py-1 text-xs font-semibold bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400">
                      Cerrar
                    </button>
                  </>
                )}
              </div>
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
