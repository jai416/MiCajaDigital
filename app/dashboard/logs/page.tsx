import { supabaseAdmin } from '@/lib/supabase';
import LimpiarLogs from './LimpiarLogs';

export const dynamic = 'force-dynamic';

interface LogEntry {
  id: string;
  user_id: string | null;
  nivel: string;
  origen: string;
  mensaje: string;
  created_at: string;
  email: string | null;
  nombre_negocio: string | null;
}

async function getLogs() {
  const { data: logs } = await supabaseAdmin
    .from('app_logs')
    .select('id, user_id, nivel, origen, mensaje, created_at')
    .order('created_at', { ascending: false })
    .limit(300);

  const userIdMap: Record<string, true> = {};
  for (const l of logs ?? []) {
    if (l.user_id) userIdMap[String(l.user_id)] = true;
  }
  const userIds = Object.keys(userIdMap);
  const { data: negocios } = userIds.length
    ? await supabaseAdmin
        .from('negocios')
        .select('user_id, email, nombre_negocio')
        .in('user_id', userIds)
    : { data: [] as { user_id: string; email: string; nombre_negocio: string }[] };

  const porUser = new Map<string, { email: string; nombre_negocio: string }>();
  for (const n of negocios ?? []) {
    if (n.user_id) porUser.set(n.user_id, { email: n.email, nombre_negocio: n.nombre_negocio });
  }

  return (logs ?? []).map<LogEntry>((l) => ({
    id: String(l.id),
    user_id: l.user_id ? String(l.user_id) : null,
    nivel: String(l.nivel ?? 'error'),
    origen: String(l.origen ?? ''),
    mensaje: String(l.mensaje ?? ''),
    created_at: l.created_at ? String(l.created_at) : '',
    email: l.user_id ? porUser.get(String(l.user_id))?.email ?? null : null,
    nombre_negocio: l.user_id
      ? porUser.get(String(l.user_id))?.nombre_negocio ?? null
      : null,
  }));
}

const NIVEL_COLOR: Record<string, string> = {
  error: 'bg-red-100 text-red-700',
  info: 'bg-blue-100 text-blue-700',
};

export default async function LogsPage() {
  const logs = await getLogs();

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Logs de la app</h1>
        <div className="flex flex-col items-end gap-1">
          <span className="text-sm text-gray-500">
            Últimos {logs.length} errores reportados por las clientas
          </span>
          <LimpiarLogs />
        </div>
      </div>

      <p className="text-sm text-gray-500 mb-6">
        La app envía aquí sus errores críticos (en segundo plano, solo cuando hay
        conexión). Usa esta vista para detectar fallos antes de que las clientas
        los reporten por WhatsApp. Los logs de más de 30 días se borran solos si
        pg_cron está activo en Supabase; si no, usa el botón "Limpiar logs
        antiguos".
      </p>

      {logs.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-10 text-center text-gray-400">
          Aún no hay errores reportados. 🎉
        </div>
      ) : (
        <div className="space-y-3">
          {logs.map((l) => (
            <div
              key={l.id}
              className="bg-white rounded-xl shadow-sm border border-gray-200 p-4"
            >
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <span
                  className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                    NIVEL_COLOR[l.nivel] ?? 'bg-gray-100 text-gray-600'
                  }`}
                >
                  {l.nivel}
                </span>
                <span className="text-xs font-mono text-gray-600">{l.origen}</span>
                {l.nombre_negocio && (
                  <span className="text-xs text-gray-500">
                    {l.nombre_negocio} · {l.email}
                  </span>
                )}
                <span className="text-xs text-gray-400 ml-auto">
                  {l.created_at
                    ? new Date(l.created_at).toLocaleString('es-CU', { timeZone: 'UTC' })
                    : ''}{' '}
                  UTC
                </span>
              </div>
              <pre className="text-xs text-gray-700 whitespace-pre-wrap break-words bg-gray-50 rounded-lg p-3">
                {l.mensaje}
              </pre>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
