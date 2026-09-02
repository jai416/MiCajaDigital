import { supabaseAdmin } from '@/lib/supabase';
import { requireSession } from '@/lib/auth';
import NegociosTable from './NegociosTable';

export const dynamic = 'force-dynamic';

const POR_PAGINA = 50;

interface SearchParams {
  q?: string;
  page?: string;
  plan?: string;
  estado?: string;
  expiran?: string;
}

async function getNegocios(sp: SearchParams) {
  let query = supabaseAdmin
    .from('negocios')
    .select('*', { count: 'exact' })
    .order('fecha_registro', { ascending: false });

  const termino = (sp.q ?? '').trim().replace(/[,()]/g, '');
  if (termino) {
    query = query.or(
      `email.ilike.%${termino}%,nombre_negocio.ilike.%${termino}%`
    );
  }

  // Filtro por plan
  if (sp.plan && sp.plan !== 'todos') {
    query = query.eq('plan', sp.plan);
  }

  // Filtro por estado
  const ahora = new Date();
  if (sp.estado && sp.estado !== 'todos') {
    if (sp.estado === 'activo') {
      query = query.eq('activo', true).gt('fecha_expiracion', ahora.toISOString());
    } else if (sp.estado === 'inactivo') {
      query = query.eq('activo', false);
    } else if (sp.estado === 'expirado') {
      query = query.eq('activo', true).lt('fecha_expiracion', ahora.toISOString());
    } else if (sp.estado === 'papelera') {
      query = query.not('deleted_at', 'is', null);
    }
  }

  // Filtro por expiración próxima
  if (sp.expiran && sp.expiran !== 'todos') {
    const dias = parseInt(sp.expiran, 10);
    const desde = new Date(ahora);
    const hasta = new Date(ahora);
    hasta.setDate(hasta.getDate() + dias);
    query = query
      .eq('activo', true)
      .gte('fecha_expiracion', desde.toISOString())
      .lte('fecha_expiracion', hasta.toISOString());
  }

  const pagina = Math.max(1, parseInt(sp.page ?? '1', 10) || 1);
  const desde = (pagina - 1) * POR_PAGINA;
  const { data, error, count } = await query.range(desde, desde + POR_PAGINA - 1);

  if (error) {
    console.error('Error fetching negocios:', error);
    return { negocios: [], total: 0, pagina };
  }
  return { negocios: data ?? [], total: count ?? 0, pagina };
}

export default async function NegociosPage({
  searchParams,
}: {
  searchParams?: SearchParams;
}) {
  await requireSession();
  const sp = searchParams ?? {};
  const { negocios, total, pagina } = await getNegocios(sp);
  const totalPaginas = Math.max(1, Math.ceil(total / POR_PAGINA));
  const enPapelera = negocios.filter((n) => n.deleted_at).length;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold text-gray-800">Negocios</h1>
        <span className="text-sm text-gray-500">
          {total} registros · página {pagina} de {totalPaginas}
          {enPapelera > 0 ? ` · ${enPapelera} en papelera` : ''}
        </span>
      </div>

      <form action="/dashboard/negocios" method="get" className="mb-6 space-y-3">
        {/* Fila 1: búsqueda */}
        <div className="flex gap-2">
          <input type="search" name="q" defaultValue={sp.q ?? ''}
            placeholder="Buscar por email o nombre..."
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none" />
          <button type="submit"
            className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-semibold transition">
            Buscar
          </button>
          {(sp.q || sp.plan || sp.estado || sp.expiran) && (
            <a href="/dashboard/negocios"
              className="px-4 py-2 border border-gray-300 text-gray-600 rounded-lg hover:bg-gray-50 transition text-sm">
              Limpiar filtros
            </a>
          )}
        </div>

        {/* Fila 2: filtros */}
        <div className="flex flex-wrap gap-3">
          <select name="plan" defaultValue={sp.plan ?? 'todos'}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white">
            <option value="todos">Todos los planes</option>
            <option value="basico">Básico</option>
            <option value="pro">Pro</option>
            <option value="premium">Premium</option>
          </select>

          <select name="estado" defaultValue={sp.estado ?? 'todos'}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white">
            <option value="todos">Todos los estados</option>
            <option value="activo">Activo</option>
            <option value="inactivo">Inactivo</option>
            <option value="expirado">Expirado</option>
            <option value="papelera">En papelera</option>
          </select>

          <select name="expiran" defaultValue={sp.expiran ?? 'todos'}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white">
            <option value="todos">Sin filtro de expiración</option>
            <option value="3">Expiran en 3 días</option>
            <option value="7">Expiran en 7 días</option>
            <option value="15">Expiran en 15 días</option>
            <option value="30">Expiran en 30 días</option>
          </select>
        </div>
      </form>

      <NegociosTable
        negocios={negocios}
        paginacion={{ pagina, totalPaginas, q: sp.q ?? '' }}
      />
    </div>
  );
}
