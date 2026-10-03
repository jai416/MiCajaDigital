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
  /** Ruta en el bucket privado (solo lectura para el panel: se sirve firmado). */
  audio_path?: string | null;
  /** URL firmada de 1 h que devuelve /api/soporte. */
  audio_url?: string | null;
  created_at: string;
  updated_at: string;
  email?: string;
  nombre_negocio?: string;
}

const ESTADOS = ['todos', 'abierto', 'en_progreso', 'resuelto', 'cerrado'] as const;
const CAT_LABELS: Record<string, string> = {
  pago: ' Pago', sync: ' Sync', bug: ' Bug', sugerencia: ' Sugerencia', otro: ' Otro',
};
const CAT_COLORS: Record<string, string> = {
  pago: 'bg-mc-warning/10 text-mc-warning', sync: 'bg-mc-info/10 text-mc-info',
  bug: 'bg-mc-danger/10 text-mc-danger', sugerencia: 'bg-mc-primary/10 text-mc-primary',
  otro: 'bg-mc-field text-mc-text',
};
const ESTADO_COLORS: Record<string, string> = {
  abierto: 'bg-mc-danger/10 text-mc-danger', en_progreso: 'bg-mc-warning/10 text-mc-warning',
  resuelto: 'bg-mc-primary/10 text-mc-primary', cerrado: 'bg-mc-field text-mc-muted',
};

const PLANTILLAS = [
  { id: 'pago_recibido', label: ' Pago recibido', texto: '¡Hola! Hemos recibido tu pago. En breve recibirás tu código de activación por correo. ¡Gracias!' },
  { id: 'codigo_enviado', label: ' Código enviado', texto: '¡Hola! Tu código de activación ha sido enviado a tu correo. Recuerda que tiene 24 horas de vigencia.' },
  { id: 'renovacion', label: ' Aviso renovación', texto: '¡Hola! Tu suscripción está por vencer. Si necesitas renovar, contáctanos para generar un nuevo código.' },
  { id: 'sync_ok', label: ' Sync resuelto', texto: '¡Hola! El problema de sincronización ha sido revisado. Por favor, intenta sincronizar de nuevo desde la app.' },
  { id: 'bug_investigando', label: ' Bug en investigación', texto: '¡Hola! Hemos recibido tu reporte y lo estamos investigando. Te avisaremos cuando esté resuelto.' },
  { id: 'gracias', label: ' Gracias', texto: '¡Gracias por contactarnos! Si tienes otra pregunta, no dudes en escribirnos.' },
  { id: 'personalizado', label: ' Personalizado', texto: '' },
];

export default function SoportePage() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [filtro, setFiltro] = useState('abierto');
  const [pagina, setPagina] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPaginas, setTotalPaginas] = useState(1);
  const [cargado, setCargado] = useState(false);
  const [editando, setEditando] = useState<number | null>(null);
  const [respuesta, setRespuesta] = useState('');
  const [plantillaSel, setPlantillaSel] = useState('');

  const [tomandoId, setTomandoId] = useState<number | null>(null);
  const [feedback, setFeedback] = useState('');

  useEffect(() => {
    if (feedback) {
      const t = setTimeout(() => setFeedback(''), 3000);
      return () => clearTimeout(t);
    }
  }, [feedback]);

  const cargar = async (p: number = 1) => {
    try {
      const res = await fetch(`/api/soporte?pagina=${p}&porPagina=20&estado=${filtro}`);
      const json = await res.json();
      if (res.ok) {
        setTickets(json.data ?? []);
        setPagina(json.pagina ?? 1);
        setTotalPaginas(json.totalPaginas ?? 1);
        setTotal(json.total ?? 0);
      } else {
        setFeedback(`Error: ${json.error ?? 'No se pudieron cargar los tickets'}`);
      }
    } catch {
      setFeedback('Error de conexión al cargar tickets');
    }
    setCargado(true);
  };

  useEffect(() => { cargar(1); }, [filtro]);

  const actualizar = async (id: number, estado: string, resp?: string) => {
    if (estado === 'en_progreso') setTomandoId(id);
    try {
      const res = await fetch('/api/soporte', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, estado, respuesta_admin: resp }),
      });
      const json = await res.json();
      if (!res.ok) {
        setFeedback(`Error: ${json.error ?? 'No se pudo actualizar'}`);
        return;
      }
      setEditando(null);
      setRespuesta('');
      setPlantillaSel('');
      await cargar(pagina);
    } catch {
      setFeedback('Error de conexión al actualizar ticket');
    } finally {
      setTomandoId(null);
    }
  };

  const aplicarPlantilla = (pid: string) => {
    setPlantillaSel(pid);
    const pl = PLANTILLAS.find((p) => p.id === pid);
    if (pl) setRespuesta(pl.texto);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-mc-text">Soporte</h1>
        <div className="flex items-center gap-3">
          <a href="/dashboard/soporte/mensajes"
            className="px-3 py-1.5 bg-mc-primary text-white rounded-lg text-sm font-semibold hover:bg-mc-primary transition">
             Enviar mensaje
          </a>
          <span className="text-sm text-mc-muted">{total} tickets</span>
        </div>
      </div>

      {feedback && (
        <div className={`mb-4 px-4 py-2 rounded-lg text-sm font-semibold ${
          feedback.startsWith('Error') ? 'bg-mc-danger/10 text-mc-danger' : 'bg-mc-primary/10 text-mc-primary'
        }`}>
          {feedback}
        </div>
      )}

      <div className="flex gap-2 mb-6">
        {ESTADOS.map((e) => (
          <button key={e} onClick={() => setFiltro(e)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold transition ${
              filtro === e ? 'bg-mc-primary text-white' : 'bg-mc-field text-mc-muted hover:bg-mc-border'
            }`}>
            {e === 'todos' ? 'Todos' : e.replace('_', '')}
          </button>
        ))}
      </div>

      <div className="space-y-4">
        {!cargado && <p className="text-mc-muted">Cargando...</p>}
        {cargado && tickets.length === 0 && (
          <p className="text-mc-muted">No hay tickets en este filtro.</p>
        )}
        {tickets.map((t) => (
          <div key={t.id} className="bg-mc-surface rounded-xl shadow-sm border border-mc-border p-5">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <span className={`px-2 py-1 rounded-full text-xs font-semibold ${CAT_COLORS[t.categoria] ?? CAT_COLORS.otro}`}>
                    {CAT_LABELS[t.categoria] ?? t.categoria}
                  </span>
                  <span className={`px-2 py-1 rounded-full text-xs font-semibold ${ESTADO_COLORS[t.estado]}`}>
                    {t.estado.replace('_', '')}
                  </span>
                  <span className="text-xs text-mc-muted">#{t.id}</span>
                </div>
                {t.mensaje && (
                  <p className="text-sm text-mc-text whitespace-pre-wrap">{t.mensaje}</p>
                )}
                {t.audio_url && (
                  <audio controls preload="none" src={t.audio_url}
                    className="mt-2 w-full max-w-sm">
                    Tu navegador no puede reproducir este audio.
                  </audio>
                )}
                {t.respuesta_admin && (
                  <div className="mt-3 bg-mc-soft border border-mc-primary rounded-lg p-3">
                    <p className="text-xs font-semibold text-mc-primary mb-1">Tu respuesta:</p>
                    <p className="text-sm text-mc-primary whitespace-pre-wrap">{t.respuesta_admin}</p>
                  </div>
                )}
                <p className="text-xs text-mc-muted mt-2">{fechaHora(t.created_at)}</p>
              </div>
              <div className="flex flex-col gap-1 shrink-0">
                {t.estado !== 'cerrado' && (
                  <>
                    {t.estado === 'abierto' && (
                      <button onClick={() => actualizar(t.id, 'en_progreso')}
                        disabled={tomandoId === t.id}
                        className="px-3 py-1 text-xs font-semibold bg-mc-warning text-white rounded-lg hover:bg-mc-warning disabled:opacity-50">
                        {tomandoId === t.id ? 'Tomando...' : 'Tomar'}
                      </button>
                    )}
                    {editando === t.id ? (
                      <div className="space-y-2 w-56">
                        {/* Selector de plantillas */}
                        <select value={plantillaSel} onChange={(e) => aplicarPlantilla(e.target.value)}
                          className="w-full px-2 py-1 border border-mc-border rounded text-xs bg-mc-surface">
                          <option value="">-- Plantilla --</option>
                          {PLANTILLAS.map((p) => (
                            <option key={p.id} value={p.id}>{p.label}</option>
                          ))}
                        </select>
                        <textarea value={respuesta} onChange={(e) => setRespuesta(e.target.value)}
                          placeholder="Respuesta..." rows={4}
                          className="w-full px-2 py-1 border border-mc-border rounded text-xs" />
                        <div className="flex gap-1">
                          <button onClick={() => actualizar(t.id, 'resuelto', respuesta)}
                            className="px-2 py-1 text-xs bg-mc-primary text-white rounded">Enviar</button>
                          <button onClick={() => { setEditando(null); setPlantillaSel(''); }}
                            className="px-2 py-1 text-xs bg-mc-border rounded">Cancelar</button>
                        </div>
                      </div>
                    ) : (
                      <button onClick={() => { setEditando(t.id); setRespuesta(t.respuesta_admin ?? ''); }}
                        className="px-3 py-1 text-xs font-semibold bg-mc-primary text-white rounded-lg hover:bg-mc-primary">
                        Responder
                      </button>
                    )}
                    <button onClick={() => actualizar(t.id, 'cerrado')}
                      className="px-3 py-1 text-xs font-semibold bg-mc-border text-mc-text rounded-lg hover:bg-mc-field">
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
            className="px-4 py-2 border border-mc-border rounded-lg text-sm font-semibold disabled:opacity-40">
             Anterior
          </button>
          <span className="text-xs text-mc-muted">Página {pagina} de {totalPaginas}</span>
          <button onClick={() => cargar(pagina + 1)} disabled={pagina >= totalPaginas}
            className="px-4 py-2 border border-mc-border rounded-lg text-sm font-semibold disabled:opacity-40">
            Siguiente 
          </button>
        </div>
      )}
    </div>
  );
}
