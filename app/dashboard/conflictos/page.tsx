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
  email?: string | null;
  nombre_negocio?: string | null;
  fila_actual?: Record<string, unknown> | null;
}

const TABLAS = ['ventas', 'gastos', 'catalogo', 'compras', 'pago_fiado'];
const CAMPOS_EDITABLES: Record<string, string[]> = {
  ventas: ['producto', 'precio', 'costo', 'cliente', 'pagado', 'metodo_pago', 'moneda',
    'tipo_pedido', 'anticipo', 'saldo_pendiente', 'estado_pedido', 'nota', 'telefono', 'vendedor',
    'descuento', 'devuelto', 'catalogo_id', 'negocio_id', 'fecha'],
  gastos: ['concepto', 'monto', 'fecha', 'categoria', 'negocio_id'],
  catalogo: ['nombre', 'precio', 'costo', 'stock', 'descripcion', 'codigo_barras', 'categoria', 'foto', 'negocio_id'],
  compras: ['producto', 'costo_unitario', 'cantidad', 'costo_total', 'proveedor', 'fecha', 'negocio_id'],
  pago_fiado: ['venta_id', 'monto', 'fecha', 'negocio_id'],
};

function etiquetaAccion(accion: string): string {
  switch (accion) {
    case 'sobrescrito': return 'Remoto sobrescribió local';
    case 'push_saltado': return 'Push saltado (remoto más nuevo)';
    case 'resuelto': return 'Resuelto';
    case 'mantener_remoto': return 'Mantener remoto';
    case 'mantener_local': return 'Mantener local';
    case 'reparado': return 'Reparado desde el panel';
    case 'ignorado': return 'Ignorado';
    case 'en_progreso': return 'En progreso';
    default: return accion;
  }
}

export default function ConflictosPage() {
  const [conflictos, setConflictos] = useState<Conflicto[]>([]);
  const [soloPendientes, setSoloPendientes] = useState(true);
  const [tablaFiltro, setTablaFiltro] = useState('');
  const [pagina, setPagina] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPaginas, setTotalPaginas] = useState(1);
  const [cargado, setCargado] = useState(false);
  const [resolviendoId, setResolviendoId] = useState<number | null>(null);
  const [reparandoId, setReparandoId] = useState<number | null>(null);
  const [expandido, setExpandido] = useState<Set<number>>(new Set());
  const [borradores, setBorradores] = useState<Record<number, Record<string, string>>>({});
  const [feedback, setFeedback] = useState('');

  useEffect(() => {
    if (feedback) {
      const t = setTimeout(() => setFeedback(''), 3000);
      return () => clearTimeout(t);
    }
  }, [feedback]);

  const cargar = async (p: number = 1) => {
    try {
      const tabla = tablaFiltro ? `&tabla=${tablaFiltro}` : '';
      const res = await fetch(`/api/conflictos?pagina=${p}&porPagina=30&pendientes=${soloPendientes}${tabla}`);
      const json = await res.json();
      if (res.ok) {
        setConflictos(json.data ?? []);
        setPagina(json.pagina ?? 1);
        setTotalPaginas(json.totalPaginas ?? 1);
        setTotal(json.total ?? 0);
      } else {
        setFeedback(`Error: ${json.error ?? 'No se pudieron cargar los conflictos'}`);
      }
    } catch {
      setFeedback('Error de conexión al cargar conflictos');
    }
    setCargado(true);
  };

  useEffect(() => { cargar(1); }, [soloPendientes, tablaFiltro]);

  const resolver = async (id: number, accion: string) => {
    setResolviendoId(id);
    try {
      const res = await fetch('/api/conflictos', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, resuelto: true, accion }),
      });
      const json = await res.json();
      if (!res.ok) {
        setFeedback(`Error: ${json.error ?? 'No se pudo resolver'}`);
        return;
      }
      await cargar(pagina);
    } catch {
      setFeedback('Error de conexión al resolver conflicto');
    } finally {
      setResolviendoId(null);
    }
  };

  const reparar = async (c: Conflicto) => {
    const borrador = borradores[c.id] ?? {};
    const cambios = Object.fromEntries(
      Object.entries(borrador).filter(([, v]) => v.trim() !== '')
    );
    if (Object.keys(cambios).length === 0) {
      setFeedback('Escribe al menos un campo para reparar');
      return;
    }
    setReparandoId(c.id);
    try {
      const res = await fetch('/api/conflictos', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: c.id, resuelto: true, accion: 'reparado', fila: cambios }),
      });
      const json = await res.json();
      if (!res.ok) {
        setFeedback(`Error: ${json.error ?? 'No se pudo reparar'}`);
        return;
      }
      setBorradores((prev) => { const nx = { ...prev }; delete nx[c.id]; return nx; });
      await cargar(pagina);
    } catch {
      setFeedback('Error de conexión al reparar conflicto');
    } finally {
      setReparandoId(null);
    }
  };

  const toggleExpandido = (id: number) => {
    setExpandido((prev) => {
      const nx = new Set(prev);
      if (nx.has(id)) nx.delete(id); else nx.add(id);
      return nx;
    });
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-gray-800">Conflictos de sync</h1>
        <div className="flex items-center gap-3">
          <select
            value={tablaFiltro}
            onChange={(e) => setTablaFiltro(e.target.value)}
            className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm bg-white">
            <option value="">Todas las tablas</option>
            {TABLAS.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <label className="flex items-center gap-2 text-sm text-gray-600">
            <input type="checkbox" checked={soloPendientes}
              onChange={(e) => setSoloPendientes(e.target.checked)}
              className="rounded" />
            Solo pendientes
          </label>
          <span className="text-sm text-gray-500">{total} conflictos</span>
        </div>
      </div>

      {feedback && (
        <div className={`mb-4 px-4 py-2 rounded-lg text-sm font-semibold ${
          feedback.startsWith('Error') ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'
        }`}>
          {feedback}
        </div>
      )}

      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6">
        <p className="text-sm text-amber-800">
          <strong>¿Qué son los conflictos?</strong> Cuando dos dispositivos editan la misma fila offline y sincronizan,
          el último en subir sobrescribe al otro. Este registro muestra qué fila cambió y su estado actual en la nube.
          Puedes dejar constancia de la decisión o reparar el valor directamente.
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
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2 mb-2">
                  <span className="px-2 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-700">
                    {c.tabla}
                  </span>
                  <span className="font-mono text-xs text-gray-500">fila {c.row_id.slice(0, 12)}…</span>
                  {c.campo && <span className="font-mono text-xs text-gray-500">campo: {c.campo}</span>}
                  {(c.email || c.nombre_negocio) && (
                    <span className="text-xs text-gray-600">
                      {c.nombre_negocio ? `${c.nombre_negocio} — ` : ''}{c.email ?? 'sin email'}
                    </span>
                  )}
                  <span className="px-2 py-1 rounded-full text-xs font-semibold bg-purple-100 text-purple-700">
                    {etiquetaAccion(c.accion)}
                  </span>
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

                <button
                  onClick={() => toggleExpandido(c.id)}
                  className="mt-2 text-xs font-semibold text-blue-600 hover:text-blue-800">
                  {expandido.has(c.id) ? '▼ Ocultar fila actual' : '▶ Ver fila actual en nube'}
                </button>

                {expandido.has(c.id) && (
                  <div className="mt-2 bg-gray-50 rounded-lg p-3 border border-gray-200">
                    {c.fila_actual && Object.keys(c.fila_actual).length > 0 ? (
                      <div className="space-y-2">
                        <div className="grid grid-cols-2 gap-x-3 gap-y-1 max-h-64 overflow-y-auto">
                          {Object.entries(c.fila_actual).map(([k, v]) => (
                            <div key={k} className="flex gap-1 text-xs">
                              <span className="text-gray-500 font-semibold shrink-0">{k}:</span>
                              <span className="text-gray-700 font-mono break-all">{String(v)}</span>
                            </div>
                          ))}
                        </div>
                        {!c.resuelto && CAMPOS_EDITABLES[c.tabla] ? (
                          <div className="border-t border-gray-200 pt-2 mt-2">
                            <p className="text-xs font-semibold text-gray-600 mb-1">
                              Reparar valor en la nube (escribe solo los campos a corregir):
                            </p>
                            <div className="grid grid-cols-2 gap-2">
                              {CAMPOS_EDITABLES[c.tabla].map((campo) => (
                                <input
                                  key={campo}
                                  value={borradores[c.id]?.[campo] ?? ''}
                                  onChange={(e) => setBorradores((prev) => ({
                                    ...prev,
                                    [c.id]: { ...(prev[c.id] ?? {}), [campo]: e.target.value },
                                  }))}
                                  placeholder={campo}
                                  className="px-2 py-1 text-xs border border-gray-300 rounded-lg font-mono"
                                />
                              ))}
                            </div>
                            <button
                              onClick={() => reparar(c)}
                              disabled={reparandoId === c.id}
                              className="mt-2 px-3 py-1 text-xs font-semibold bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 disabled:opacity-50">
                              {reparandoId === c.id ? 'Reparando...' : 'Guardar corrección'}
                            </button>
                          </div>
                        ) : (
                          <p className="text-xs text-gray-400 mt-2">Conflicto ya resuelto — no editable.</p>
                        )}
                      </div>
                    ) : (
                      <p className="text-xs text-gray-400">
                        La fila ya no existe en la tabla {c.tabla} (fue borrada) — solo queda constancia.
                      </p>
                    )}
                  </div>
                )}

                <p className="text-xs text-gray-400 mt-2">{fechaHora(c.created_at)}</p>
              </div>
              {!c.resuelto && (
                <div className="flex flex-col gap-2 shrink-0">
                  <button onClick={() => resolver(c.id, 'mantener_remoto')}
                    disabled={resolviendoId === c.id}
                    className="px-3 py-1 text-xs font-semibold bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 disabled:opacity-50">
                    Mantener remoto
                  </button>
                  <button onClick={() => resolver(c.id, 'en_progreso')}
                    disabled={resolviendoId === c.id}
                    className="px-3 py-1 text-xs font-semibold bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50">
                    En progreso
                  </button>
                  <button onClick={() => resolver(c.id, 'ignorado')}
                    disabled={resolviendoId === c.id}
                    className="px-3 py-1 text-xs font-semibold bg-gray-400 text-white rounded-lg hover:bg-gray-500 disabled:opacity-50">
                    Ignorar
                  </button>
                </div>
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