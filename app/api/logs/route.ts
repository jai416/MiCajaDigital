import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getSession } from '@/lib/auth';
import { registrarAccion } from '@/lib/audit';

export const dynamic = 'force-dynamic';

// DELETE por días (legacy) — mantiene compatibilidad con el botón "Limpiar logs"
export async function DELETE(request: NextRequest) {
  try {
    if (!(await getSession())) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const body = await request.json().catch(() => null);
    const sp = request.nextUrl.searchParams;

    // DELETE por UUIDs específicos (nuevo: selección individual/masiva)
    if (body?.uuids && Array.isArray(body.uuids)) {
      const uuids = body.uuids.filter((u: string) => typeof u === 'string' && u.length > 0);
      if (uuids.length === 0) {
        return NextResponse.json({ error: 'Sin UUIDs' }, { status: 400 });
      }
      const { error, count } = await supabaseAdmin
        .from('app_logs')
        .delete({ count: 'exact' })
        .in('log_uuid', uuids);
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
      await registrarAccion('logs_eliminados_selectivos', 'logs', null, {
        cantidad: count ?? 0,
      });
      return NextResponse.json({ ok: true, borrados: count ?? 0 });
    }

    // DELETE todos los logs
    if (body?.todos === true) {
      const { error, count } = await supabaseAdmin
        .from('app_logs')
        .delete({ count: 'exact' });
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
      await registrarAccion('logs_eliminados_todos', 'logs', null, {
        borrados: count ?? 0,
      });
      return NextResponse.json({ ok: true, borrados: count ?? 0 });
    }

    // DELETE por días (legacy) — compatibilidad
    const crudo = Number(sp.get('dias') ?? 30);
    if (!Number.isFinite(crudo)) {
      return NextResponse.json({ error: 'Parámetro dias no válido' }, { status: 400 });
    }
    const dias = Math.min(730, Math.max(1, Math.floor(crudo)));
    const corte = new Date(Date.now() - dias * 86400000).toISOString();
    const { error, count } = await supabaseAdmin
      .from('app_logs')
      .delete({ count: 'exact' })
      .lt('created_at', corte);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    await registrarAccion('logs_purgados', 'logs', null, {
      dias,
      borrados: count ?? 0,
    });
    return NextResponse.json({ ok: true, borrados: count ?? 0 });
  } catch {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
