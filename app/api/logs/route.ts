import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getSession } from '@/lib/auth';
import { registrarAccion } from '@/lib/audit';

export const dynamic = 'force-dynamic';

export async function DELETE(request: NextRequest) {
  try {
    // Doble capa: además del middleware, la ruta se protege por sí misma
    // (igual que /api/negocios y /api/codigos).
    if (!(await getSession())) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    // Clamp del rango: entre 1 y 730 días. Sin esto, `dias=0` borraba TODO
    // (incluidos los logs de hoy) con un solo click fatigoso.
    const crudo = Number(request.nextUrl.searchParams.get('dias') ?? 30);
    if (!Number.isFinite(crudo)) {
      return NextResponse.json({ error: 'Parámetro dias no válido' }, { status: 400 });
    }
    const dias = Math.min(730, Math.max(1, Math.floor(crudo)));

    const corte = new Date(Date.now() - dias * 86400000).toISOString();
    const { error, count } = await supabaseAdmin
      .from('app_logs')
      .delete({ count: 'exact' })
      .lt('created_at', corte);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    await registrarAccion('logs_purgados', 'logs', null, {
      dias,
      borrados: count ?? 0,
    });
    return NextResponse.json({ ok: true, borrados: count ?? 0 });
  } catch {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
