'use client';

import { useEffect, useState } from 'react';
import { fechaHora } from '@/lib/formato';

interface LogEntry {
  id: string;
  log_uuid: string | null;
  user_id: string | null;
  nivel: string;
  origen: string;
  mensaje: string;
  created_at: string;
  email: string | null;
  nombre_negocio: string | null;
}

const NIVEL_COLOR: Record<string, string> = {
  error: 'bg-red-100 text-red-700',
  info: 'bg-blue-100 text-blue-700',
};

export default function LogsPage() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [cargado, setCargado] = useState(false);
  const [seleccion, setSeleccion] = useState<Set<string>>(new Set());
  const [eliminando, setEliminando] = useState(false);
  const [feedback, setFeedback] = useState('');

  const cargar = async () => {
    const res = await fetch('/api/logs?pagina=1&porPagina=300');
    const json = await res.json();
    if (res.ok) setLogs(json.data ?? []);
    setCargado(true);
  };

  useEffect(() => { cargar(); }, []);

  const toggleSeleccion = (uuid: string) => {
    setSeleccion((prev) => {
      const next = new Set(prev);
      if (next.has(uuid)) next.delete(uuid);
      else next.add(uuid);
      return next;
    });
  };

  const toggleTodo = () => {
    if (seleccion.size === logs.length) setSeleccion(new Set());
    else setSeleccion(new Set(logs.map((l) => l.log_uuid).filter(Boolean) as string[]));
  };

  const eliminarSeleccionados = async () => {
    if (seleccion.size === 0) return;
    if (!confirm(`¿Eliminar ${seleccion.size} log(s) seleccionado(s)?`)) return;
    setEliminando(true);
    try {
      const res = await fetch('/api/logs', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uuids: Array.from(seleccion) }),
      });
      const json = await res.json();
      if (res.ok) {
        setFeedback(`✓ ${json.borrados} logs eliminados`);
        setSeleccion(new Set());
        await cargar();
      } else {
        setFeedback(`Error: ${json.error}`);
      }
    } catch {
      setFeedback('Error de conexión');
    }
    setEliminando(false);
    setTimeout(() => setFeedback(''), 3000);
  };

  const eliminarTodos = async () => {
    if (!confirm('¿Eliminar TODOS los logs? Esta acción no se puede deshacer.')) return;
    setEliminando(true);
    try {
      const res = await fetch('/api/logs', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ todos: true }),
      });
      const json = await res.json();
      if (res.ok) {
        setFeedback(`✓ ${json.borrados} logs eliminados`);
        setSeleccion(new Set());
        await cargar();
      } else {
        setFeedback(`Error: ${json.error}`);
      }
    } catch {
      setFeedback('Error de conexión');
    }
    setEliminando(false);
    setTimeout(() => setFeedback(''), 3000);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Logs de la app</h1>
        <div className="flex items-center gap-2">
          <button onClick={cargar}
            className="px-3 py-1.5 text-xs font-semibold bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100">
            🔄 Recargar
          </button>
        </div>
      </div>

      <p className="text-sm text-gray-500 mb-4">
        La app envía errores críticos aquí. Cada log incluye fecha/hora UTC. Puedes
        seleccionar logs individuales o eliminar todos.
      </p>

      {feedback && (
        <div className={`mb-4 px-4 py-2 rounded-lg text-sm font-semibold ${
          feedback.startsWith('✓') ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
        }`}>
          {feedback}
        </div>
      )}

      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <button onClick={toggleTodo}
            className="px-3 py-1.5 text-xs font-semibold bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200">
            {seleccion.size === logs.length ? 'Deseleccionar todo' : 'Seleccionar todo'}
          </button>
          {seleccion.size > 0 && (
            <button onClick={eliminarSeleccionados} disabled={eliminando}
              className="px-3 py-1.5 text-xs font-semibold bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:opacity-50">
              🗑️ Eliminar {seleccion.size} seleccionado(s)
            </button>
          )}
        </div>
        <button onClick={eliminarTodos} disabled={eliminando}
          className="px-3 py-1.5 text-xs font-semibold bg-red-100 text-red-600 rounded-lg hover:bg-red-200 disabled:opacity-50">
          🗑️ Eliminar todos
        </button>
      </div>

      {!cargado && <p className="text-gray-500">Cargando...</p>}
      {cargado && logs.length === 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-10 text-center text-gray-500">
          Aún no hay errores reportados.
        </div>
      )}

      <div className="space-y-2">
        {logs.map((l) => (
          <div key={l.id}
            className={`bg-white rounded-xl shadow-sm border p-4 transition ${
              seleccion.has(l.log_uuid ?? '') ? 'border-blue-400 bg-blue-50' : 'border-gray-200'
            }`}>
            <div className="flex items-start gap-3">
              <input type="checkbox"
                checked={seleccion.has(l.log_uuid ?? '')}
                onChange={() => l.log_uuid && toggleSeleccion(l.log_uuid)}
                className="mt-1 rounded shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                    NIVEL_COLOR[l.nivel] ?? 'bg-gray-100 text-gray-600'
                  }`}>
                    {l.nivel}
                  </span>
                  <span className="text-xs font-mono text-gray-600">{l.origen}</span>
                  {l.nombre_negocio && (
                    <span className="text-xs text-gray-500">
                      {l.nombre_negocio} · {l.email}
                    </span>
                  )}
                </div>
                <pre className="text-xs text-gray-700 whitespace-pre-wrap break-words bg-gray-50 rounded-lg p-2 mt-1">
                  {l.mensaje}
                </pre>
                <p className="text-[11px] text-gray-400 mt-1">
                  {l.created_at
                    ? new Date(l.created_at).toLocaleString('es-CU', { timeZone: 'UTC' })
                    : 'sin fecha'}{' '}
                  UTC
                  {l.log_uuid && (
                    <span className="ml-2 font-mono text-gray-300">{l.log_uuid.slice(0, 8)}</span>
                  )}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
