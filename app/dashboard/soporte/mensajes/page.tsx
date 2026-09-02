'use client';

import { useEffect, useState } from 'react';
import { fechaHora } from '@/lib/formato';

interface Negocio {
  id: string;
  nombre_negocio: string;
  email: string;
}

interface Mensaje {
  id: number;
  user_id: string;
  titulo: string;
  mensaje: string;
  leido: boolean;
  created_at: string;
  negocios?: { nombre_negocio: string; email: string } | null;
}

export default function MensajesPage() {
  const [mensajes, setMensajes] = useState<Mensaje[]>([]);
  const [negocios, setNegocios] = useState<Negocio[]>([]);
  const [pagina, setPagina] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPaginas, setTotalPaginas] = useState(1);
  const [cargado, setCargado] = useState(false);

  const [formUserId, setFormUserId] = useState('');
  const [formTitulo, setFormTitulo] = useState('');
  const [formMensaje, setFormMensaje] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [feedback, setFeedback] = useState('');

  const cargar = async (p: number = 1) => {
    try {
      const res = await fetch(`/api/mensajes?pagina=${p}&porPagina=20`);
      const json = await res.json();
      if (res.ok) {
        setMensajes(json.data ?? []);
        setPagina(json.pagina ?? 1);
        setTotalPaginas(json.totalPaginas ?? 1);
        setTotal(json.total ?? 0);
      } else {
        setFeedback(`Error: ${json.error ?? 'No se pudieron cargar los mensajes'}`);
      }
    } catch {
      setFeedback('Error de conexión al cargar mensajes');
    }
    setCargado(true);
  };

  const cargarNegocios = async () => {
    try {
      const res = await fetch('/api/negocios?porPagina=500&activo=todos');
      const json = await res.json();
      if (res.ok) setNegocios(json.data ?? []);
    } catch { /* silent */ }
  };

  useEffect(() => {
    cargar(1);
    cargarNegocios();
  }, []);

  const enviar = async () => {
    if (enviando) return;
    setEnviando(true);
    const res = await fetch('/api/mensajes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id: formUserId,
        titulo: formTitulo,
        mensaje: formMensaje,
      }),
    });
    const json = await res.json();
    if (res.ok) {
      setFormUserId('');
      setFormTitulo('');
      setFormMensaje('');
      await cargar(1);
    } else {
      alert(json.error ?? 'Error al enviar');
    }
    setEnviando(false);
  };

  const eliminar = async (id: number) => {
    if (!confirm('¿Eliminar este mensaje?')) return;
    try {
      const res = await fetch(`/api/mensajes?id=${id}`, { method: 'DELETE' });
      const json = await res.json();
      if (!res.ok) {
        setFeedback(`Error: ${json.error ?? 'No se pudo eliminar'}`);
        return;
      }
      await cargar(pagina);
    } catch {
      setFeedback('Error de conexión al eliminar mensaje');
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Mensajes directos</h1>
        <span className="text-sm text-gray-500">{total} mensajes</span>
      </div>

      {feedback && (
        <div className={`mb-4 px-4 py-2 rounded-lg text-sm font-semibold ${
          feedback.startsWith('Error') ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'
        }`}>
          {feedback}
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 mb-6">
        <h2 className="text-sm font-semibold text-gray-700 mb-4">Enviar mensaje</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Destinatario</label>
            <select
              value={formUserId}
              onChange={(e) => setFormUserId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-emerald-500 focus:border-emerald-500"
            >
              <option value="">Seleccionar usuario…</option>
              {negocios.map((n) => (
                <option key={n.id} value={n.id}>
                  {n.nombre_negocio} ({n.email})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Título</label>
            <input
              type="text"
              value={formTitulo}
              onChange={(e) => setFormTitulo(e.target.value)}
              placeholder="Título del mensaje…"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-emerald-500 focus:border-emerald-500"
            />
          </div>
        </div>
        <div className="mb-4">
          <label className="block text-xs font-medium text-gray-600 mb-1">Mensaje</label>
          <textarea
            value={formMensaje}
            onChange={(e) => setFormMensaje(e.target.value)}
            placeholder="Escribe el mensaje…"
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-emerald-500 focus:border-emerald-500"
          />
        </div>
        <button
          onClick={enviar}
          disabled={!formUserId || formTitulo.trim().length < 3 || formMensaje.trim().length < 5 || enviando}
          className="px-5 py-2 bg-emerald-600 text-white text-sm font-semibold rounded-lg hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed transition"
        >
          {enviando ? 'Enviando…' : 'Enviar mensaje'}
        </button>
      </div>

      <div className="space-y-4">
        {!cargado && <p className="text-gray-500">Cargando…</p>}
        {cargado && mensajes.length === 0 && (
          <p className="text-gray-500">No hay mensajes enviados.</p>
        )}
        {mensajes.map((m) => (
          <div key={m.id} className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-sm font-semibold text-gray-800">
                    {m.negocios?.nombre_negocio ?? '—'}
                  </span>
                  <span className="text-xs text-gray-400">{m.negocios?.email ?? ''}</span>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                    m.leido ? 'bg-gray-100 text-gray-500' : 'bg-emerald-100 text-emerald-700'
                  }`}>
                    {m.leido ? 'Leído' : 'No leído'}
                  </span>
                </div>
                <p className="text-sm font-medium text-gray-700 mb-1">{m.titulo}</p>
                <p className="text-sm text-gray-500 whitespace-pre-wrap line-clamp-2">{m.mensaje}</p>
                <p className="text-xs text-gray-400 mt-2">{fechaHora(m.created_at)}</p>
              </div>
              <button
                onClick={() => eliminar(m.id)}
                className="px-3 py-1 text-xs font-semibold bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition shrink-0"
              >
                Eliminar
              </button>
            </div>
          </div>
        ))}
      </div>

      {totalPaginas > 1 && (
        <div className="flex items-center justify-between mt-6">
          <button
            onClick={() => cargar(pagina - 1)}
            disabled={pagina <= 1}
            className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-semibold disabled:opacity-40"
          >
            ← Anterior
          </button>
          <span className="text-xs text-gray-500">Página {pagina} de {totalPaginas}</span>
          <button
            onClick={() => cargar(pagina + 1)}
            disabled={pagina >= totalPaginas}
            className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-semibold disabled:opacity-40"
          >
            Siguiente →
          </button>
        </div>
      )}
    </div>
  );
}
