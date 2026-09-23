import { supabaseAdmin } from '@/lib/supabase';
import { requireSession } from '@/lib/auth';
import { fechaHora } from '@/lib/formato';
import { getAppVersion } from '@/lib/version';

export const dynamic = 'force-dynamic';

const VERSION_ESPERADA = getAppVersion();

interface NegocioVersion {
  id: string;
  email: string | null;
  nombre_negocio: string | null;
  plan: string | null;
  activo: boolean;
  deleted_at: string | null;
  app_version: string | null;
  app_version_code: string | null;
  app_version_at: string | null;
}

async function getVersiones() {
  const { data, error } = await supabaseAdmin
    .from('negocios')
    .select(
      'id, email, nombre_negocio, plan, activo, deleted_at, app_version, app_version_code, app_version_at'
    )
    .order('app_version_at', { ascending: false, nullsFirst: false });

  if (error) {
    console.error('Error fetching versiones:', error);
    return { negocios: [] as NegocioVersion[] };
  }
  return { negocios: (data ?? []) as NegocioVersion[] };
}

export default async function VersionesPage() {
  await requireSession();
  const { negocios } = await getVersiones();

  const conReporte = negocios.filter((n) => n.app_version && !n.deleted_at);
  const actualizadas = conReporte.filter((n) => n.app_version === VERSION_ESPERADA);
  const desactualizadas = conReporte.filter((n) => n.app_version !== VERSION_ESPERADA);
  const sinReporte = negocios.filter((n) => !n.app_version && !n.deleted_at);

  // Agrupación por versión para el resumen
  const porVersion = new Map<string, number>();
  for (const n of conReporte) {
    porVersion.set(n.app_version!, (porVersion.get(n.app_version!) ?? 0) + 1);
  }
  const versiones = [...porVersion.entries()].sort((a, b) => b[1] - a[1]);

  const estadoDe = (n: NegocioVersion): 'actualizada' | 'desactualizada' | 'sin-reporte' => {
    if (!n.app_version || n.deleted_at) return 'sin-reporte';
    return n.app_version === VERSION_ESPERADA ? 'actualizada' : 'desactualizada';
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold text-gray-800">Versiones instaladas</h1>
        <span className="text-sm text-gray-500">
          Versión esperada: <strong className="text-gray-800">{VERSION_ESPERADA}</strong>
        </span>
      </div>

      {/* Resumen */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
          <p className="text-xs text-gray-500 font-medium uppercase">Con reporte</p>
          <p className="text-2xl font-bold text-gray-800 mt-1">{conReporte.length}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-emerald-200 p-5">
          <p className="text-xs text-emerald-700 font-medium uppercase">Al día</p>
          <p className="text-2xl font-bold text-emerald-700 mt-1">{actualizadas.length}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-amber-200 p-5">
          <p className="text-xs text-amber-700 font-medium uppercase">Desactualizadas</p>
          <p className="text-2xl font-bold text-amber-700 mt-1">{desactualizadas.length}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
          <p className="text-xs text-gray-500 font-medium uppercase">Sin reporte</p>
          <p className="text-2xl font-bold text-gray-800 mt-1">{sinReporte.length}</p>
        </div>
      </div>

      {/* Distribución por versión */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 mb-6">
        <h2 className="text-sm font-semibold text-gray-700 mb-3">Distribución por versión</h2>
        {versiones.length === 0 ? (
          <p className="text-sm text-gray-500">Todavía no hay reportes de versión.</p>
        ) : (
          <div className="space-y-2">
            {versiones.map(([v, count]) => (
              <div key={v} className="flex items-center gap-3">
                <span className="w-24 text-sm font-mono text-gray-700">{v}</span>
                <div className="flex-1 bg-gray-100 rounded-full h-2.5 overflow-hidden">
                  <div
                    className={`h-full rounded-full ${v === VERSION_ESPERADA ? 'bg-emerald-500' : 'bg-amber-400'}`}
                    style={{
                      width: `${negocios.length ? Math.max(4, (count / negocios.length) * 100) : 0}%`,
                    }}
                  />
                </div>
                <span className="w-8 text-sm text-gray-600 text-right">{count}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Tabla */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Usuario</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Negocio</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Plan</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Versión</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Code</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Último reporte</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {negocios.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-sm text-gray-500">
                    No hay negocios registrados.
                  </td>
                </tr>
              )}
              {negocios.map((n) => {
                const estado = estadoDe(n);
                return (
                  <tr key={n.id} className="hover:bg-gray-50">
                    <td className="px-6 py-3 text-sm text-gray-800">{n.email ?? '—'}</td>
                    <td className="px-6 py-3 text-sm text-gray-600">{n.nombre_negocio ?? '—'}</td>
                    <td className="px-6 py-3 text-sm text-gray-600">{n.plan ?? '—'}</td>
                    <td className="px-6 py-3 text-sm font-mono text-gray-800">{n.app_version ?? '—'}</td>
                    <td className="px-6 py-3 text-sm font-mono text-gray-500">{n.app_version_code ?? '—'}</td>
                    <td className="px-6 py-3 text-sm text-gray-500">{fechaHora(n.app_version_at)}</td>
                    <td className="px-6 py-3 text-sm">
                      {n.deleted_at ? (
                        <span className="px-2 py-0.5 bg-gray-200 text-gray-600 rounded text-xs">Papelera</span>
                      ) : estado === 'actualizada' ? (
                        <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded text-xs font-semibold">Al día</span>
                      ) : estado === 'desactualizada' ? (
                        <span className="px-2 py-0.5 bg-amber-100 text-amber-700 rounded text-xs font-semibold">Desactualizada</span>
                      ) : (
                        <span className="px-2 py-0.5 bg-gray-100 text-gray-500 rounded text-xs">Sin reporte</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <p className="mt-4 text-xs text-gray-400">
        La app reporta su versión al arrancar (RPC reportar_version_app, una vez por sesión). Los negocios sin
        reporte aún no han abierto una versión con esta función o llevan tiempo sin sincronizar.
      </p>
    </div>
  );
}