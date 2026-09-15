import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const s = await getSession();
    if (!s) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const sp = request.nextUrl.searchParams;
    const pagina = Math.max(1, Number(sp.get('pagina') ?? 1) || 1);
    const porPagina = Math.min(100, Math.max(1, Number(sp.get('porPagina') ?? 50) || 50));
    const desde = (pagina - 1) * porPagina;
    const busqueda = sp.get('q')?.trim();

    // Paso 1: buscar negocios por email o nombre si se provee búsqueda
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

    // Paso 2: consultar app_logs (actividad de la app: sync, errores, etc.)
    let logsQuery = supabaseAdmin
      .from('app_logs')
      .select('user_id, nivel, origen, mensaje, created_at', { count: 'exact' })
      .order('created_at', { ascending: false });

    if (negociosFiltrados) logsQuery = logsQuery.in('user_id', negociosFiltrados);

    // Paginación server-side para no cargar todo en memoria
    logsQuery = logsQuery.range(desde, desde + porPagina - 1);

    const { data: logsData, error: logsError, count: logsCount } = await logsQuery;
    if (logsError) { console.error('API error:', logsError); return NextResponse.json({ error: 'Error interno' }, { status: 500 }); }

    // Paso 3: enriquecer con datos del negocio (email, nombre)
    const negocioIds = [...new Set((logsData ?? []).map((r: { user_id: string }) => String(r.user_id)))];
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

    // Paso 4: resumen por usuario (basado en logs)
    const resumenMap = new Map<string, {
      email: string; nombre: string; ultimaSync: string; totalLogs: number;
      errores: number; warnings: number; infos: number;
      ultimosLogs: Array<{ nivel: string; origen: string; mensaje: string; created_at: string }>;
    }>();

    for (const row of (logsData ?? []) as Record<string, unknown>[]) {
      const nid = String(row.user_id);
      const neg = negocioMap.get(nid) ?? { email: '', nombre_negocio: '' };
      if (!resumenMap.has(nid)) {
        resumenMap.set(nid, {
          email: neg.email, nombre: neg.nombre_negocio,
          ultimaSync: String(row.created_at ?? ''),
          totalLogs: 0, errores: 0, warnings: 0, infos: 0,
          ultimosLogs: [],
        });
      }
      const res = resumenMap.get(nid)!;
      res.totalLogs++;
      const nivel = String(row.nivel ?? '');
      if (nivel === 'error') res.errores++;
      else if (nivel === 'warning') res.warnings++;
      else res.infos++;
      if (res.ultimosLogs.length < 5) {
        res.ultimosLogs.push({
          nivel, origen: String(row.origen ?? ''), mensaje: String(row.mensaje ?? ''),
          created_at: String(row.created_at ?? ''),
        });
      }
    }

    // Convertir a array y ordenar por última actividad
    const actividad = Array.from(resumenMap.entries())
      .map(([user_id, res]) => ({
        negocio_id: user_id,
        email: res.email,
        nombre: res.nombre,
        ultimaSync: res.ultimaSync,
        totalSyncs: res.totalLogs,
        exitosos: res.infos,
        fallidos: res.errores,
        ventasSync: 0,
        gastosSync: 0,
        ultimosLogs: res.ultimosLogs,
      }))
      .sort((a, b) => (b.ultimaSync ?? '').localeCompare(a.ultimaSync ?? ''));

    return NextResponse.json({
      data: actividad.slice(desde, desde + porPagina),
      total: actividad.length,
      pagina,
      totalPaginas: Math.ceil(actividad.length / porPagina),
    });
  } catch (e) {
    console.error('API error:', e);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
