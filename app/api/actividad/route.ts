import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';

interface LogRow {
  user_id: string;
  nivel: string;
  origen: string;
  mensaje: string;
  created_at: string;
}

// Máximo de logs a consultar para listar usuarios activos (los negocios son
// pocos; cada uno genera decenas de logs). Queda acotado y ordenado.
const MAX_LOG_ROWS = 5000;
const LOGS_POR_USUARIO = 50;

export async function GET(request: NextRequest) {
  try {
    const s = await getSession();
    if (!s) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const sp = request.nextUrl.searchParams;
    const pagina = Math.max(1, Number(sp.get('pagina') ?? 1) || 1);
    const porPagina = Math.min(100, Math.max(1, Number(sp.get('porPagina') ?? 50) || 50));
    const busqueda = sp.get('q')?.trim();

    // Paso 1: filtrar por negocio si se provee búsqueda
    let negociosFiltrados: string[] | null = null;
    if (busqueda) {
      const sanitized = busqueda.replace(/[%_]/g, '').slice(0, 100);
      const { data: negMatch } = await supabaseAdmin
        .from('negocios')
        .select('id')
        .or(`email.ilike.%${sanitized}%,nombre_negocio.ilike.%${sanitized}%`)
        .limit(200);
      negociosFiltrados = (negMatch ?? []).map((n: { id: string }) => String(n.id));
      if (negociosFiltrados.length === 0) {
        return NextResponse.json({ data: [], total: 0, pagina, totalPaginas: 0 });
      }
    }

    // Paso 2: logs acotados (ordenados por actividad) para derivar el listado
    // de USUARIOS con vida. Se pagina por usuario (no por fila de log).
    let logsQuery = supabaseAdmin
      .from('app_logs')
      .select('user_id, nivel, origen, mensaje, created_at')
      .order('created_at', { ascending: false })
      .limit(MAX_LOG_ROWS);

    if (negociosFiltrados) logsQuery = logsQuery.in('user_id', negociosFiltrados);

    const { data: logsAll, error: logsError } = await logsQuery;
    if (logsError) { console.error('API error:', logsError); return NextResponse.json({ error: 'Error interno' }, { status: 500 }); }

    const logs = (logsAll ?? []) as LogRow[];

    // Paso 3: agrupar por usuario y derivar su resumen (todos los logs del
    // ventana acotada → totales correctos por usuario).
    const grupos = new Map<string, {
      ultimaSync: string;
      totalLogs: number;
      errores: number;
      warnings: number;
      infos: number;
      ultimosLogs: LogRow[];
    }>();
    for (const row of logs) {
      const nid = String(row.user_id ?? '');
      if (!nid) continue;
      let g = grupos.get(nid);
      if (!g) {
        g = { ultimaSync: '', totalLogs: 0, errores: 0, warnings: 0, infos: 0, ultimosLogs: [] };
        grupos.set(nid, g);
      }
      if (!g.ultimaSync || String(row.created_at ?? '') > g.ultimaSync) {
        g.ultimaSync = String(row.created_at ?? '');
      }
      g.totalLogs++;
      if (row.nivel === 'error') g.errores++;
      else if (row.nivel === 'warning') g.warnings++;
      else g.infos++;
      if (g.ultimosLogs.length < 5) g.ultimosLogs.push(row);
    }

    const usuarios = Array.from(grupos.entries())
      .sort((a, b) => (b[1].ultimaSync ?? '').localeCompare(a[1].ultimaSync ?? ''))
      .map(([user_id, res]) => ({ user_id, ...res }));

    // Paso 4: paginar sobre los USUARIOS (server-side)
    const total = usuarios.length;
    const totalPaginas = Math.max(1, Math.ceil(total / porPagina));
    const desdeRel = (pagina - 1) * porPagina;
    const paginaUsuarios = usuarios.slice(desdeRel, desdeRel + porPagina);

    // Paso 5: enriquecer con datos del negocio + traer sus últimos logs reales
    // (agotando hasta LOGS_POR_USUARIO por cada uno de la página).
    const negocioIds = [...new Set(paginaUsuarios.map((u) => u.user_id))];
    let negocioMap = new Map<string, { email: string; nombre_negocio: string }>();
    if (negocioIds.length > 0) {
      const { data: negs } = await supabaseAdmin
        .from('negocios')
        .select('id, email, nombre_negocio')
        .in('id', negocioIds);
      for (const n of (negs ?? []) as Array<{ id: string; email: string; nombre_negocio: string }>) {
        negocioMap.set(String(n.id), { email: n.email ?? '', nombre_negocio: n.nombre_negocio ?? '' });
      }
    }

    const detallePorUsuario = new Map<string, { nivel: string; origen: string; mensaje: string; created_at: string }[]>();
    if (negocioIds.length > 0) {
      const { data: logsDetalle } = await supabaseAdmin
        .from('app_logs')
        .select('user_id, nivel, origen, mensaje, created_at')
        .in('user_id', negocioIds)
        .order('created_at', { ascending: false })
        .limit(LOGS_POR_USUARIO * negocioIds.length);
      for (const row of (logsDetalle ?? []) as LogRow[]) {
        const nid = String(row.user_id);
        if (!detallePorUsuario.has(nid)) detallePorUsuario.set(nid, []);
        const lista = detallePorUsuario.get(nid)!;
        if (lista.length < 5) lista.push(row);
      }
    }

    const actividad = paginaUsuarios.map((u) => {
      const neg = negocioMap.get(u.user_id) ?? { email: '', nombre_negocio: '' };
      return {
        negocio_id: u.user_id,
        email: neg.email,
        nombre: neg.nombre_negocio,
        ultimaSync: u.ultimaSync,
        totalSyncs: u.totalLogs,
        exitosos: u.infos,
        fallidos: u.errores,
        warnings: u.warnings,
        ultimosLogs: detallePorUsuario.get(u.user_id) ?? u.ultimosLogs,
      };
    });

    return NextResponse.json({ data: actividad, total, pagina, totalPaginas });
  } catch (e) {
    console.error('API error:', e);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}