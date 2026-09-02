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
    const userId = sp.get('user_id');
    const busqueda = sp.get('q')?.trim();

    // Paso 1: buscar negocios por email o nombre si se provee búsqueda
    let negociosFiltrados: string[] | null = null;
    if (busqueda) {
      const { data: negMatch } = await supabaseAdmin
        .from('negocios')
        .select('id')
        .or(`email.ilike.%${busqueda}%,nombre_negocio.ilike.%${busqueda}%`)
        .limit(200);
      negociosFiltrados = (negMatch ?? []).map((n: { id: string }) => String(n.id));
      if (negociosFiltrados.length === 0) {
        return NextResponse.json({ data: [], total: 0, pagina, totalPaginas: 0 });
      }
    }

    // Paso 2: consultar sync_log (actividad de sincronización)
    let syncQuery = supabaseAdmin
      .from('sync_log')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(desde, desde + porPagina - 1);

    if (userId) syncQuery = syncQuery.eq('negocio_id', userId);
    if (negociosFiltrados) syncQuery = syncQuery.in('negocio_id', negociosFiltrados);

    const { data: syncData, error: syncError, count: syncCount } = await syncQuery;
    if (syncError) return NextResponse.json({ error: syncError.message }, { status: 500 });

    // Paso 3: enriquecer con datos del negocio (email, nombre)
    const negocioIds = [...new Set((syncData ?? []).map((r: { negocio_id: string }) => String(r.negocio_id)))];
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

    // Paso 4: consultar logs de errores recientes de esos negocios
    let logsQuery = supabaseAdmin
      .from('app_logs')
      .select('user_id, nivel, origen, mensaje, created_at')
      .order('created_at', { ascending: false })
      .limit(200);

    if (userId) logsQuery = logsQuery.eq('user_id', userId);
    if (negociosFiltrados) logsQuery = logsQuery.in('user_id', negociosFiltrados);

    const { data: logsData } = await logsQuery;

    // Paso 5:.getActivitySummary - resumen por negocio
    const resumenMap = new Map<string, {
      email: string; nombre: string; ultimaSync: string; totalSyncs: number;
      exitosos: number; fallidos: number; ventasSync: number; gastosSync: number;
      ultimosLogs: Array<{ nivel: string; origen: string; mensaje: string; created_at: string }>;
    }>();

    for (const row of (syncData ?? []) as Record<string, unknown>[]) {
      const nid = String(row.negocio_id);
      const neg = negocioMap.get(nid) ?? { email: '', nombre_negocio: '' };
      if (!resumenMap.has(nid)) {
        resumenMap.set(nid, {
          email: neg.email, nombre: neg.nombre_negocio,
          ultimaSync: String(row.created_at ?? ''),
          totalSyncs: 0, exitosos: 0, fallidos: 0,
          ventasSync: 0, gastosSync: 0, ultimosLogs: [],
        });
      }
      const res = resumenMap.get(nid)!;
      res.totalSyncs++;
      if (row.error) res.fallidos++;
      else res.exitosos++;
      res.ventasSync += Number(row.ventas_subidas ?? 0) + Number(row.ventas_bajadas ?? 0);
      res.gastosSync += Number(row.gastos_subidos ?? 0) + Number(row.gastos_bajados ?? 0);
    }

    // Agregar logs de errores
    for (const log of (logsData ?? []) as Array<{ user_id: string; nivel: string; origen: string; mensaje: string; created_at: string }>) {
      const nid = String(log.user_id);
      if (resumenMap.has(nid)) {
        resumenMap.get(nid)!.ultimosLogs.push({
          nivel: log.nivel, origen: log.origen, mensaje: log.mensaje, created_at: log.created_at,
        });
      }
    }

    // Convertir a array y ordenar por última sync
    const actividad = Array.from(resumenMap.entries())
      .map(([negocio_id, res]) => ({
        negocio_id,
        email: res.email,
        nombre: res.nombre,
        ultimaSync: res.ultimaSync,
        totalSyncs: res.totalSyncs,
        exitosos: res.exitosos,
        fallidos: res.fallidos,
        ventasSync: res.ventasSync,
        gastosSync: res.gastosSync,
        ultimosLogs: res.ultimosLogs.slice(0, 5),
      }))
      .sort((a, b) => (b.ultimaSync ?? '').localeCompare(a.ultimaSync ?? ''));

    return NextResponse.json({
      data: actividad.slice(desde, desde + porPagina),
      total: actividad.length,
      pagina,
      totalPaginas: Math.ceil(actividad.length / porPagina),
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error interno' },
      { status: 500 }
    );
  }
}
