import { supabaseAdmin } from '@/lib/supabase';
import NegociosTable from './NegociosTable';

export const dynamic = 'force-dynamic';

const POR_PAGINA = 50;

interface SearchParams {
  q?: string;
  page?: string;
}

async function getNegocios(q: string, pagina: number) {
  let query = supabaseAdmin
    .from('negocios')
    .select('*', { count: 'exact' })
    .order('fecha_registro', { ascending: false });

  // Búsqueda server-side en email y nombre. Se sanea el término para no romper
  // la sintaxis del filtro or= de PostgREST (comas y paréntesis).
  const termino = q.trim().replace(/[,()]/g, '');
  if (termino) {
    query = query.or(
      `email.ilike.%${termino}%,nombre_negocio.ilike.%${termino}%`
    );
  }

  const desde = (pagina - 1) * POR_PAGINA;
  const { data, error, count } = await query.range(desde, desde + POR_PAGINA - 1);

  if (error) {
    console.error('Error fetching negocios:', error);
    return { negocios: [], total: 0 };
  }
  return { negocios: data ?? [], total: count ?? 0 };
}

export default async function NegociosPage({
  searchParams,
}: {
  searchParams?: SearchParams;
}) {
  const q = searchParams?.q ?? '';
  const paginaNum = Number(searchParams?.page);
  const pagina =
    Number.isInteger(paginaNum) && paginaNum > 0 ? Math.min(paginaNum, 10000) : 1;

  const { negocios, total } = await getNegocios(q, pagina);
  const totalPaginas = Math.max(1, Math.ceil(total / POR_PAGINA));
  const enPapelera = negocios.filter((n) => n.deleted_at).length;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold text-gray-800">Negocios</h1>
        <span className="text-sm text-gray-500">
          {total} registros · página {pagina} de {totalPaginas}
          {enPapelera > 0 ? ` · ${enPapelera} en papelera (en esta página)` : ''}
        </span>
      </div>

      <form action="/dashboard/negocios" method="get" className="mb-6 flex gap-2">
        <input
          type="search"
          name="q"
          defaultValue={q}
          placeholder="Buscar por email o nombre..."
          aria-label="Buscar negocios por email o nombre"
          className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
        />
        <button
          type="submit"
          className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-semibold transition"
        >
          Buscar
        </button>
        {q && (
          <a
            href="/dashboard/negocios"
            className="px-4 py-2 border border-gray-300 text-gray-600 rounded-lg hover:bg-gray-50 transition text-sm"
          >
            Limpiar
          </a>
        )}
      </form>

      <NegociosTable
        negocios={negocios}
        paginacion={{ pagina, totalPaginas, q }}
      />
    </div>
  );
}
